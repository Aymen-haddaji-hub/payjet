import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Sablier } from '../build/Sablier/Sablier_Sablier';
import '@ton/test-utils';

describe('Sablier', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let sablier: SandboxContract<Sablier>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        sablier = blockchain.openContract(await Sablier.fromInit());

        deployer = await blockchain.treasury('deployer');

        const deployResult = await sablier.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            null,
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: sablier.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and sablier are ready to use
    });
});
