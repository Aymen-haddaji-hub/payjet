import { toNano } from '@ton/core';
import { Sablier } from '../build/Sablier/Sablier_Sablier';
import { NetworkProvider } from '@ton/blueprint';

export async function run(provider: NetworkProvider) {
    const sablier = provider.open(await Sablier.fromInit());

    await sablier.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        null,
    );

    await provider.waitForDeploy(sablier.address);

    // run methods on `sablier`
}
