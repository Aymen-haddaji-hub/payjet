.PHONY: setup lint

setup:
    # Setup Go modules
    mkdir -p core && cd core && go mod init payjet-core && go get github.com/gin-gonic/gin

lint:
    find . -name '*.go' -exec gofmt -s -w {} \;
    find . -name '*.fc' -exec ./scripts/func-lint {} \;