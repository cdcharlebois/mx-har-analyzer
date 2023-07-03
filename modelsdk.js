"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const mendixplatformsdk_1 = require("mendixplatformsdk");
function isDataElement(structureTypeName) {
    return ["Pages$DataView", "Pages$ListView"].indexOf(structureTypeName) > -1;
}
function getParentDataElement(structure) {
    // @ts-ignore
    const { name, $Type, $ID } = structure.toJSON();
    const ret = { name, $Type, $ID };
    if (isDataElement(structure.structureTypeName)) {
        return ret;
    }
    else if (structure.structureTypeName === "Pages$Page") {
        return ret;
    }
    else {
        return getParentDataElement(structure.container);
    }
}
function buildPageTreeNodesFrom(pde, all) {
    const children = all.filter((dataElement) => {
        return dataElement.dataParent.$ID === pde.$ID;
    });
    if (children.length === 0) {
        return pde;
    }
    else {
        return {
            ...pde,
            children: children.map(child => buildPageTreeNodesFrom(child, all))
        };
    }
}
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
    const lpage = await pages[0].load();
    // console.log(lpage.toJSON())
    // console.log(`title: ${lpage.title}`);
    const pageTree = {};
    const pageDataElements = [];
    lpage.traverse(structure => {
        if (isDataElement(structure.structureTypeName)) {
            // console.log(`id: ${structure.id}, unit: ${structure.unit}`);
            // @ts-ignore
            const { name, $Type, $ID } = structure.toJSON();
            // const unit = structure.unit;
            const ret = {
                name, $Type, $ID, dataParent: getParentDataElement(structure.container)
            };
            // console.log(ret)
            pageDataElements.push(ret);
        }
    });
    const roots = pageDataElements.filter((dataElement) => {
        return dataElement.dataParent.$Type === "Pages$Page";
    });
    roots.forEach((root) => {
        const leaf = buildPageTreeNodesFrom(root, pageDataElements);
        // @ts-ignore
        pageTree[root.$ID] = leaf;
    });
    console.dir(pageTree, { depth: null });
    // const pageTree: string[] = [];
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
exports.main = main;
// main().catch(console.error);
