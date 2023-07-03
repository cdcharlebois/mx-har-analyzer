"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = void 0;
const mendixplatformsdk_1 = require("mendixplatformsdk");
function isDataElement(structureTypeName) {
    return ["Pages$DataView", "Pages$ListView"].indexOf(structureTypeName) > -1;
}
function getParentDataElement(structure) {
    // @ts-ignore
    if (isDataElement(structure.structureTypeName)) {
        return getReadablePageDataElementFromStructure(structure);
    }
    else if (structure.structureTypeName === "Pages$Page") {
        return getReadablePageDataElementFromStructure(structure);
    }
    else {
        return getParentDataElement(structure.container);
    }
}
function buildPageTreeNodesFrom(pde, all) {
    const children = all.filter((dataElement) => {
        return dataElement.dataParent.$ID === pde.$ID;
    });
    const { dataParent, ...rest } = pde;
    if (children.length === 0) {
        return {
            ...rest,
        };
    }
    else {
        return {
            ...rest,
            children: children.map((child) => buildPageTreeNodesFrom(child, all)),
            childrenCount: children.length
        };
    }
}
function getReadablePageDataElementFromStructure(structure) {
    // @ts-ignore
    const { name, $Type, $ID, dataSource } = structure.toJSON();
    const friendlyDataSourceType = dataSource?.$Type;
    let friendlyDataSourceText;
    let _ds;
    switch (friendlyDataSourceType) {
        case "Pages$ListenTargetSource":
            friendlyDataSourceText = `Listens to ${dataSource.listenTarget}`;
            _ds = dataSource;
            break;
        case "Pages$DataViewSource":
        case "Pages$AssociationSource":
            // read datatSource.entityRed.steps[] OR ...entityRef.entity
            if (dataSource.entityRef.$Type === "DomainModels$DirectEntityRef") {
                friendlyDataSourceText = `Context: ${dataSource.entityRef.entity}`;
            }
            else {
                friendlyDataSourceText = `Association: ${dataSource.entityRef.steps.map((step) => step.association).join('/')}`;
            }
            //   _ds = dataSource;
            break;
        case "Pages$MicroflowSource":
            friendlyDataSourceText = `Microflow: ${dataSource.microflowSettings.microflow}`;
            break;
        default:
            break;
    }
    return { name, $Type, $ID, friendlyDataSourceType, friendlyDataSourceText };
}
async function main(token, appid) {
    // console.log("hello there");
    (0, mendixplatformsdk_1.setPlatformConfig)({
        mendixToken: token,
    });
    const client = new mendixplatformsdk_1.MendixPlatformClient();
    const app = await client.getApp(appid);
    const workingCopy = await app.createTemporaryWorkingCopy("Release2.0");
    const model = await workingCopy.openModel();
    const page = await model.allPages().find((page) => {
        return page.qualifiedName === "MatrixModule.Step2_Questionnaire_2";
    });
    if (page) {
        const lpage = await page.load();
        // console.log(lpage.toJSON())
        // console.log(`title: ${lpage.title}`);
        const pageTree = {};
        const pageDataElements = [];
        lpage.traverse((structure) => {
            if (isDataElement(structure.structureTypeName)) {
                // console.log(`id: ${structure.id}, unit: ${structure.unit}`);
                // @ts-ignore
                const ret = getReadablePageDataElementFromStructure(structure);
                // throw new Error("foo");
                ret.dataParent = getParentDataElement(structure.container);
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
    }
    else {
        console.error("no page found");
    }
    model.closeConnection();
}
exports.main = main;
// main().catch(console.error);
