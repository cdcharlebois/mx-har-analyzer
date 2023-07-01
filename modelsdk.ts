// modelsdk.ts
import {domainmodels} from "mendixmodelsdk";
import {MendixPlatformClient, setPlatformConfig} from "mendixplatformsdk";

export async function main(token: string, appid: string) {
    // console.log("hello there");
    setPlatformConfig({
        mendixToken: token
    })
    const client = new MendixPlatformClient();

    const app = await client.getApp(appid);

    const workingCopy = await app.createTemporaryWorkingCopy("Release2.0");
    const model = await workingCopy.openModel();
    
    const pages = await model.allPages()
    const pageTree: string[] = [];
    // console.log(pages);
    // pages[10].asLoaded().traverse(structure => {
    //     // if (structure.structureTypeName = "Pages$Page"){
    //         // structure.traverse(s2 => {
    //             pageTree.push(structure.structureTypeName);
    //         // })
    //     // }
    // });
    // console.log(pages[10].name);
    // console.log(pageTree);

    model.closeConnection();
}

// main().catch(console.error);

