# PayJet – Full Architecture Blueprint  
*(Zero → Production in 60 days, B2B only, TON-native, Telegram-first)*

---

## 0. North-Star Metrics
- **Day 30**: 3 pilot SaaS, ≥ 100 tx, ≥ $10 k GMV  
- **Day 60**: ≥ 50 k Wallets created via PayJet, ≥ $200 k cumulative GMV  
- **Take-rate**: 1 % (subscribe) + 0.8 % (payroll) = 1.8 % net  
- **Uptime SLA**: 99.9 % (goal for Series-Seed deck)

---

## 1. Business Context Diagram
```
┌-------------┐     fiat wire      ┌---------------┐
│Advertiser /  │------------------►│  SaaS Customer │ (needs to collect + pay)
│ Investor     │                   │ (CRM, LMS, etc)│
└------┬-------┘                   └────┬─────┬------┘
       │                               │     │
       │                               │     │ 1 HTTP call
       │                               ▼     ▼
    off-ramp                        ┌------------------┐
    (Transak)                       │  PayJet Platform │
       ▲                            │  - Checkout      │
       │                            │  - Payroll       │
       │                            │  - Compliance    │
       │                            └----┬--------┬----┘
       │                                 │        │
       │                                 │        │
       │                                 ▼        ▼
    Employee/Contractor               TON chain  IPFS / S3
    (Telegram bot)                    (Jetton,Stream,Receipt)
```

---

## 2. Functional Map
| ID | Epic | User Story (one-liner) | Accept. Criteria |
|----|------|------------------------|------------------|
| F1 | Subscribe | SaaS can embed Jetton checkout in 5 min | < 30 lines JS, mobile-web works |
| F2 | Stream-Pay | SaaS can create by-second salary stream to 100 contractors in 1 API call | < 200 ms latency, gas amortised <$0.01 |
| F3 | Off-ramp | Contractor can push “Cash-out” in bot → local bank within 1 h | 80 % success 1st try, FX ≤ 1 % |
| F4 | Compliance | SaaS receives 1 PDF + CSV per month with txn hash, fiat equiv, employee detail | MRC compliant, auditor sign-off |
| F5 | Analytics | Dashboard shows GMV, active wallets, take-rate, failed tx | real-time, export CSV |

---

## 3. Logical (Component) Architecture
```
┌---------------------------┐
│  Edge Layer (Public)      │
│  - payjet.js (< 40 kB)    │
│  - payjet-react-sdk       │
└------┬------------┬-------┘
       │            │
       ▼            ▼
┌--------------┐ ┌------------------┐
│  API Gateway │ │  Telegram Bot    │  (tbot)
│  - /invoice  │ │  /start , /cashout│
│  - /stream   │ └--------┬---------┘
│  - /webhook  │          │
└----┬---------┘          │
     │                    ▼
     │              ┌-------------┐
     │              │  Wallet Svc │ (MPC, web3auth)
     │              └------┬------┘
     ▼                       ▼
┌-------------------------┐ ┌-------------------------┐
│  Core Service (Go)      │ │  TON Listener (Rust)    │
│  - invoice mgr          │ │  - watch Jetton tx      │
│  - stream mgr           │ │  - watch Sablier stream │
│  - compliance mgr       │ │  - push to Core svc     │
└----┬--------┬-----------┘ └------------┬-----------┘
     │        │                          │
     ▼        ▼                          ▼
┌--------┐ ┌-------┐              ┌-------------┐
│Postgre │ │Redis  │              │  FunC SC    │
│       │ │       │              │ - Jetton    │
└--------┘ └-------┘              │ - Sablier   │
                                  │ - Receipt   │
                                  └-----┬-------┘
                                        │
                                        ▼
                                   TON Blockchain
```

---

## 4. Technology Choices & Justify
| Component | Tech | Why NOT alternatives |
|-----------|------|----------------------|
| **Smart-contracts** | FunC (TON) | Solidity = no TVM; Tact still beta |
| **Backend** | Go 1.22 | Fast compile, great concurrency, easy hiring |
| **Chain listener** | Rust (tokio) | JSON-RPC keep-alive, low mem |
| **DB** | Postgre 15 + Timescale | Need time-series for streams |
| **Cache** | Redis 7 | Rate-limit, nonce cache |
| **Queue** | Redis Streams (for now) | No Kafka ops overhead |
| **Wallet infra** | Web3Auth MPC | Saves seed-phrase UX hell |
| **Off-ramp** | Transak API | 150+ countries, 1 contract |
| **Frontend dash** | Next.js 14 (TS) | SSR → SEO for compliance blog |
| **Embed script** | Vanilla TS → bundled w/ esbuild | < 40 kB, no React peer-dep |
| **Hosting** | GCP Cloud Run + Cloud SQL | Scale-to-zero while we find PMF |
| **CI/CD** | GitHub Actions → Terraform Cloud | PR → staging in 7 min |
| **Monitoring** | Prometheus + Grafana Cloud + PagerDuty | Free tier until 10 M tx |

---

## 5. Smart-Contract Inventory (FunC)
| File | Purpose | Gas (est.) | Audit Priority |
|------|---------|------------|----------------|
| `jetton-minter.fc` | Standard TEP-74 Jetton (USDT clone) | 0.015 TON | Low (existing) |
| `sablier-stream.fc` | Stream by-second (ERC-1620 like) | 0.03 TON | High (custom) |
| `receipt-sbt.fc` | SBT minted after each txn (compliance) | 0.01 TON | Medium |
| `fee-collector.fc` | Splits platform fee to ops-wallet + burn | 0.005 TON | Medium |

---

## 6. Data Model (simplified ERD)
```
Wallet( address PK, type, created_at )
Invoice( id PK, SaaS_id, amount, jetton_wallet, status, cid )
Stream( id PK, invoice_id, recipient, rate_per_sec, start, stop )
Compliance( id PK, month, SaaS_id, pdf_hash, csv_hash, total_usd )
SaaS( id PK, api_key, webhook_url, kyc_status )
```

---

## 7. External API Contract (REST)
```
POST /v1/invoice
Body: {saas_api_key, amount_usdt, description, redirect_url}
Resp: {invoice_id, jetton_address, embed_html, expiry}

POST /v1/stream
Body: {saas_api_key, recipients[{wallet, usdt_per_sec, duration_sec}]}
Resp: {stream_id, tx_hash, estimated_gas}

GET /v1/invoice/:id/status
Resp: {status:(pending|paid|expired), tx_hash, amount_usdt, fee_payjet}

GET /v1/compliance/:year_month
Resp: {pdf_url, csv_url, tx_hash_list[]}  (S3 pre-signed)
```

---

## 8. Security & Risk Matrix
| Risk | Likely | Impact | Mitigation |
|------|--------|--------|------------|
| Private-key leak | Low | High | MPC shards (Web3Auth) + GCP KMS |
| Smart-contract bug | Medium | High | CertiK audit before main-net |
| Rate-limit abuse | High | Medium | Redis per-IP, per-api-key (100 rpm) |
| Invoice spoofing | Medium | High | HMAC-SHA256 webhook signature |
| Employee off-ramp fail | High | Low | Multi-provider (Transak + Alchemy Pay) |

---

## 9. Development Phases & Time-Line
| Phase | Week | Deliverables | Gates |
|-------|------|--------------|-------|
| **P0 Contract** | 1 | FunC contracts + unit tests (Sandbox) | Audit lock |
| **P1 Backend** | 2-3 | Core svc + listener + local DB | Postman green |
| **P2 Widget** | 3-4 | payjet.js + Next.js dash demo | 3 SaaS alpha signed |
| **P3 Integration** | 5 | Telegram bot + off-ramp | 1st cash-out success |
| **P4 Hardening** | 6 | CI/CD, staging, rate-limit, alerting | 99.9 % uptime 7 days |
| **P5 Audit & Docs** | 7-8 | CertiK report, API docs, compliance PDF | Grant milestone 2 |
| **P6 Launch** | 9-10 | ProductHunt + TON blog + YC W25 app | $50 k MRR pipeline |

---

## 10. Team & Role Gap (today → D+60)
| Role | Who | Now → Then |
|------|-----|------------|
| **CTO / FunC** | You | lead |
| **Back-end (Go)** | need 1 senior | hire / freelancer |
| **Rust listener** | need 1 | open-source contrib |
| **DevRel / Docs** | part-time | grant can fund |
| **Audit** | CertiK | $12 k (TON grant) |
| **Design / Next** | 1 contractor | $3 k |
| **Growth** | you + intern | cold outreach SaaS |

---

## 11. Tooling & Repo Skeleton (ready to init)
```
payjet/
├─ chain/          (*.fc, build scripts, tests)
├─ listener/       (Rust, Dockerfile)
├─ core/           (Go mod, svc/, internal/, migrations/)
├─ widget/         (TypeScript, esbuild, example.html)
├─ dash/           (Next.js)
├─ bot/            (Python aiogram for speed)
├─ infra/          (Terraform, GitHub Actions)
├─ docs/           (OpenAPI, compliance templates)
└─ scripts/        (deploy, devnet-fund, load-test)
```

---

## 12. Next Concrete Actions (this week)
1. **Init GitHub repo** → push empty skeleton  
2. **Open TON grant application** (draft in Notion) → share link for collab  
3. **Create FunC dev environment** (func-js, blue-print)  
4. **Schedule 30-min call** with **3 SaaS founders** (remote-tool niche) for **LOI**  
5. **Post “hiring Go Rust dev”** in **TON Dev chat + Superteam**

