// modelsdk.ts
/**
 * @todo
 * [X] - create a function where, given a page, it returns the data element structure
 */
import { IStructure, domainmodels } from "mendixmodelsdk";
import { MendixPlatformClient, setPlatformConfig } from "mendixplatformsdk";

interface PageDataElement {
  name: string;
  $Type: string;
  $ID: string;
  dataParent?: PageDataElement;
  dataSource?: any;
  friendlyDataSourceType: string;
  friendlyDataSourceText?: string;
  _ds?: any;
  children?: PageDataElement[];
  childrenCount?: number;
}

function isDataElement(structureTypeName: string): boolean {
  return ["Pages$DataView", "Pages$ListView"].indexOf(structureTypeName) > -1;
}

function getParentDataElement(structure: IStructure): PageDataElement {
  // @ts-ignore
  if (isDataElement(structure.structureTypeName)) {
    return getReadablePageDataElementFromStructure(structure);
  } else if (structure.structureTypeName === "Pages$Page") {
    return getReadablePageDataElementFromStructure(structure);
  } else {
    return getParentDataElement(structure.container as IStructure);
  }
}

function buildPageTreeNodesFrom(
  pde: PageDataElement,
  all: PageDataElement[]
): {} {
  const children = all.filter((dataElement: any) => {
    return dataElement.dataParent.$ID === pde.$ID;
  });
  const { dataParent, ...rest } = pde;
  if (children.length === 0) {
    return {
      ...rest,
    };
  } else {
    return {
      ...rest,
      children: children.map((child) => buildPageTreeNodesFrom(child, all)),
      childrenCount: children.length,
    };
  }
}

function getReadablePageDataElementFromStructure(
  structure: IStructure
): PageDataElement {
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
      } else {
        friendlyDataSourceText = `Association: ${dataSource.entityRef.steps
          .map((step: any) => step.association)
          .join("/")}`;
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

export async function getPageDataStructure(
  token: string,
  appid: string,
  branch: string,
  pageName: string
) {
  // console.log("hello there");
  setPlatformConfig({
    mendixToken: token,
  });
  const client = new MendixPlatformClient();

  const app = await client.getApp(appid);

  const workingCopy = await app.createTemporaryWorkingCopy(branch);
  const model = await workingCopy.openModel();

  const page = await model.allPages().find((page) => {
    return page.qualifiedName === pageName;
  });
  if (page) {
    const lpage = await page.load();
    // console.log(lpage.toJSON())
    // console.log(`title: ${lpage.title}`);
    const pageTree = {};
    const pageDataElements: PageDataElement[] = [];
    lpage.traverse((structure) => {
      if (isDataElement(structure.structureTypeName)) {
        // console.log(`id: ${structure.id}, unit: ${structure.unit}`);
        // @ts-ignore
        const ret = getReadablePageDataElementFromStructure(structure);
        // throw new Error("foo");
        ret.dataParent = getParentDataElement(
          structure.container as IStructure
        );
        // console.log(ret)
        pageDataElements.push(ret);
      }
    });

    const roots = pageDataElements.filter((dataElement: any) => {
      return dataElement.dataParent.$Type === "Pages$Page";
    });
    roots.forEach((root: PageDataElement) => {
      const leaf = buildPageTreeNodesFrom(root, pageDataElements);
      // @ts-ignore
      pageTree[root.$ID] = leaf;
    });
    // console.dir(pageTree, { depth: null });
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
    return pageTree;
  } else {
    console.error("no page found");
    model.closeConnection();
    throw new Error("no page found");
  }
}

// main().catch(console.error);
