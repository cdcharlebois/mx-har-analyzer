"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const mendixplatformsdk_1 = require("mendixplatformsdk");
async function main(token, appid) {
    (0, mendixplatformsdk_1.setPlatformConfig)({
        mendixToken: token
    });
    const client = new mendixplatformsdk_1.MendixPlatformClient();
    const app = await client.getApp(appid);
    const workingCopy = await app.createTemporaryWorkingCopy("main");
    const model = workingCopy.openModel();
}
exports.main = main;
// main().catch(console.error);
