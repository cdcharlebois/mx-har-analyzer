/**
 * @todo
 * [ ] - extract the pages that are loaded from the HAR
 */
const fs = require("fs");
const path = process.argv[2];
const har = require(path);
const { getPageDataStructure } = require("./modelsdk");
// const { config } = require('dotenv');
require("dotenv").config();
// console.log(process.env.PAT);

async function main() {
  let guidEntityMap = {};
  let tree = {};
  //   try {
  //     tree = await getPageDataStructure(
  //       process.env.MENDIX_TOKEN,
  //       process.env.APP_ID,
  //       process.env.PAGE_NAME
  //     );
  //   } catch (e) {
  //     console.log(e);
  //   }
  /**
   * 1. Capture all the requests from the HAR file
   */
  const requests = har.log.entries
    .filter((entry) => {
      return (
        entry.request.method === "POST" && /xas\/$/.test(entry.request.url)
      );
    })
    .map((entry) => ({
      request: entry.request,
      response: entry.response,
    }));
  console.log(`Found ${requests.length} requests in the har file...`);

  /**
   * 2. Map to the relevant data and capture the refresh instructions
   */
  let refreshes = [];
  const mxReqLog = requests.map((req, index) => {
    let ret = {};

    // mx request
    const text = req.request.postData.text;
    const { action, params } = JSON.parse(text);
    ret.request = {
      action,
      params,
      queryId: params.queryId,
    };

    // mx response
    const responseText = req.response.content.text;
    const { changes, commits, instructions, objects } =
      JSON.parse(responseText);
    const responseObjectIds = objects.map(obj => obj.guid)
    const responseObjectClassnames = objects.map(obj => obj.objectType)
    catalogGuidEntity(responseObjectIds, responseObjectClassnames, guidEntityMap)

    // check to see if there are refresh instructions...
    const refreshInClient =
      instructions &&
      instructions.find((instr) => {
        return instr.type == "refresh_class";
      });
    if (refreshInClient) {
      // ... if so, catalog it
      const objectIds = instructions.find((instr) => {
        return instr.type == "refresh_object_list";
      }).args.ObjectIds;
      refreshes.push({
        id: index,
        entities: refreshInClient.args.classnames,
        guids: objectIds,
      });
      // ... and attempt to update the guid-entity mapping
      // (classNames[], objects[]) => void
      catalogGuidEntity(objectIds, refreshInClient.args.classnames, guidEntityMap)
    }
    ret.response = {
      changes,
      commits,
      instructions,
      objects: objects.map((fullObj) => ({
        guid: fullObj.guid,
        objectType: fullObj.objectType,
      })),
    };

    // analyze the data
    let matchingRefresh; // this points to the refresh that caused this request
    let guidIndexMatch; // this points to guid (and therefore entity) from the refresh that caused this request
    let entities = [];
    if (action === "retrieve") {
      const reqContextGuids = [];
      for (const key in params.params) {
        entities.push(key);
        reqContextGuids.push(params.params[key].guid);
      }
      // find last so that not all requests get linked to the first refresh
      matchingRefresh = refreshes.findLast((refresh) => {
        return refresh.guids.find((g, index) => {
          return reqContextGuids.find((rcg) => {
            if (g.substring(0, 5) === rcg.substring(0, 5)) {
              guidIndexMatch = index; // this might be more than one guid
              return true;
            }
            return false;
          });
        });
      });
    }

    ret.analysis = {
      id: index,
      action: action,
      queryId: params.queryId,
      source: "TBD",
      params: getFriendlyParamArray(params, guidEntityMap),
      trigger: matchingRefresh
        ? {
            id: matchingRefresh.id,
            entity: matchingRefresh.entities[guidIndexMatch], // this might be more than one guid
          }
        : undefined,
    };
    return ret;
  });

  /**
   * flatten the refresh instructions to one per entity, so we can tell which entity refreshes
   * are the most problematic
   */
  const entityRefreshes = [];
  refreshes.forEach((refresh) => {
    refresh.entities.forEach((entity) => {
      const downstreamCalls = mxReqLog
        .filter((req) => {
          return (
            req.analysis.trigger &&
            req.analysis.trigger.id === refresh.id &&
            req.analysis.trigger.entity === entity
          );
        })
        .map((dsc) => dsc.analysis);
      const downstreamCallsMap = downstreamCalls.reduce((total, current) => {
        // console.log(total);
        const existing = total.find((item) => item.id === current.queryId);
        if (existing) {
          existing.count += 1;
        } else {
          // const paramArray = getFriendlyParamArray(current, guidEntityMap);
          total.push({
            id: current.queryId,
            params: current.params,
            count: 1,
          });
        }
        return total;
      }, []);
      entityRefreshes.push({
        requestId: refresh.id,
        entity: entity,
        downStreamCallsCount: downstreamCalls.length,
        downstreamCalls: downstreamCallsMap,
      });
    });
  });
  // console.log(entityRefreshes);
  /**
   * Recommendations
   * ---
   * - given the entities in the guidEntityMap, count the number of requests with those entities in params
   */
  let recommendations = [];
  for (const key in guidEntityMap) {
    const resultingRequests = mxReqLog.filter(req => !!req.analysis.params.find(p => p.entityType === key)).length
    recommendations.push({
        entity: key,
        resultingRequests: resultingRequests,
        text: `removing the ${key} refresh will potentially result in ${resultingRequests} fewer xas requests` 
    })
  }
  const analysis = {
    recommendations,
    refreshes: entityRefreshes,
  };
  fs.writeFileSync(
    "./out.json",
    JSON.stringify({
      summary: analysis,
      entityMap: guidEntityMap,
      tree: tree,
      data: mxReqLog,
    })
  );

  console.log(
    `${
      mxReqLog.filter((req) => !req.analysis.trigger).length
    } mystery requests...`
  );
}

main();

function getFriendlyParamArray(current, guidEntityMap) {
  // console.log(current);
  const paramArray = [];
  for (const key in current.params) {
    const objectGuidPrefix = current.params[key].guid.substring(0, 5);
    for (const e in guidEntityMap) {
      if (guidEntityMap[e].indexOf(objectGuidPrefix) > -1) {
        paramArray.push({
          parameterName: key,
          parameterGuid: current.params[key].guid,
          entityType: e,
        });
        break;
      }
    }
  }
  return paramArray;
}

function catalogGuidEntity(objectIds, classnames, mapObject) {
    classnames.forEach((entity, index) => {
        const guidPrefix = objectIds[index].substring(0, 5);

        // console.log(guidEntityMap);
        // console.log(`current: {${entity}: ${guidPrefix}}`)

        if (!mapObject[entity]) {
            mapObject[entity] = [guidPrefix];
        } else if (mapObject[entity].indexOf(guidPrefix) > -1) {
          // do nothing
        } else {
            mapObject[entity].push(guidPrefix);
        }
      });
}
// console.log(mxReqLog.filter(req => !req.analysis.trigger))

/**
 * i have a mysetery query: nRpEXDoBMUaf2RMl3xb1pg
 * - seems to be the result of a refreshed SubSection, but there's no instructions to do so..
 * - showbycondition custom widget likely the refresh culprit
 *
 *  */
