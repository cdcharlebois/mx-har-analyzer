// modelsdk.ts
import {IStructure, domainmodels} from "mendixmodelsdk";
import {MendixPlatformClient, setPlatformConfig} from "mendixplatformsdk";
// import {util}
// const util = require("util");
// import {} from "menx"

interface PageDataElement {
    name: string,
    $Type: string,
    $ID: string,
    dataParent?: PageDataElement
}

function isDataElement(structureTypeName: string): boolean {
    return ["Pages$DataView", "Pages$ListView"].indexOf(structureTypeName) > -1;
}

function getParentDataElement(structure: IStructure): PageDataElement {
    // @ts-ignore
    const { name, $Type, $ID } = structure.toJSON();
    const ret = {name, $Type, $ID};
    if (isDataElement(structure.structureTypeName)) {
        return ret;
    }
    else if (structure.structureTypeName === "Pages$Page"){
        return ret;
    }
    else {
        return getParentDataElement(structure.container as IStructure);
    }
}

function buildPageTreeNodesFrom(pde: PageDataElement, all: PageDataElement[]): {} {
    const children = all.filter((dataElement: any) => {
        return dataElement.dataParent.$ID === pde.$ID
    })
    if (children.length === 0){
        return pde
    } else {
        return {
            ...pde,
            children: children.map(child => buildPageTreeNodesFrom(child, all))
        }
    }
    
}

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
    const lpage = await pages[0].load();
    // console.log(lpage.toJSON())
    // console.log(`title: ${lpage.title}`);
    const pageTree = {};
    const pageDataElements: PageDataElement[] = [];
    lpage.traverse(structure => {
        if (isDataElement(structure.structureTypeName)){
            // console.log(`id: ${structure.id}, unit: ${structure.unit}`);
            // @ts-ignore
            const { name, $Type, $ID } = structure.toJSON();
            // const unit = structure.unit;
            const ret = {
                name, $Type, $ID, dataParent: getParentDataElement(structure.container as IStructure)
            }
            // console.log(ret)
            pageDataElements.push(ret);
        }
    })

    const roots = pageDataElements.filter((dataElement: any) => {
        return dataElement.dataParent.$Type === "Pages$Page";
    })
    roots.forEach((root: PageDataElement) => {
        const leaf = buildPageTreeNodesFrom(root, pageDataElements);
        // @ts-ignore
        pageTree[root.$ID] = leaf;
    })
    console.dir(pageTree, {depth: null});
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

// main().catch(console.error);

