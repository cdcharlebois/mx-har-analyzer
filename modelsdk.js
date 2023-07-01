"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const mendixplatformsdk_1 = require("mendixplatformsdk");
async function main(token, appid) {
    // console.log("hello there");
    (0, mendixplatformsdk_1.setPlatformConfig)({
        mendixToken: token
    });
    const client = new mendixplatformsdk_1.MendixPlatformClient();
    const app = await client.getApp(appid);
    const workingCopy = await app.createTemporaryWorkingCopy("Release2.0");
    const model = await workingCopy.openModel();
    const pages = await model.allPages();
    const pageTree = [];
    // console.log(pages);
    pages[10].asLoaded().traverse(structure => {
        // if (structure.structureTypeName = "Pages$Page"){
        // structure.traverse(s2 => {
        pageTree.push(structure.structureTypeName);
        // })
        // }
    });
    console.log(pages[10].name);
    console.log(pageTree);
    model.closeConnection();
}
exports.main = main;
// main().catch(console.error);
