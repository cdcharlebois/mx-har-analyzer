// modelsdk.ts
import {domainmodels} from "mendixmodelsdk";
import {MendixPlatformClient, setPlatformConfig} from "mendixplatformsdk";

export async function main(token: string, appid: string) {
    setPlatformConfig({
        mendixToken: token
    })
    const client = new MendixPlatformClient();

    const app = await client.getApp(appid);

    const workingCopy = await app.createTemporaryWorkingCopy("main");
    const model = workingCopy.openModel();

}

// main().catch(console.error);

