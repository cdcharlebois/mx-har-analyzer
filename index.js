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
    let tree;
  try {
    tree = await getPageDataStructure(
      process.env.MENDIX_TOKEN,
      process.env.APP_ID,
      "MatrixModule.Step2_Questionnaire_2"
    );
  } catch (e) {
    console.log(e);
  }
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
    // check to see if there are refresh instructions...
    const refreshInClient =
      instructions &&
      instructions.find((instr) => {
        return instr.type == "refresh_class";
      });
    if (refreshInClient) {
      // ... if so, catalog it
      refreshes.push({
        id: index,
        entities: refreshInClient.args.classnames,
        guids: instructions.find((instr) => {
          return instr.type == "refresh_object_list";
        }).args.ObjectIds,
      });
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
    if (action === "retrieve") {
      const reqContextGuids = [];
      for (const key in params.params) {
        reqContextGuids.push(params.params[key].guid);
      }
      /**
         * @TODO - there's a bug here where downstream calls are being tied to the wrong refresh.. need to think about this one.
         * - how do we tell which to tie it to? Maybe from the model sdk?
         * 
         * e.g. this request is counted for ROW and not for QUESTIONMAIN
         * "request": {
                "action": "retrieve",
                "params": {
                    "queryId": "yaxM3R8iZU2mJFD91lgTfw",
                    "params": {
                        "QuestionMain": {
                            "guid": "75435293790178333"
                        },
                        "Row": {
                            "guid": "74027919018446481"
                        }
                    },
                    "options": {}
                },
                "queryId": "yaxM3R8iZU2mJFD91lgTfw"
            },
            "analysis": {
                "id": 20,
                "action": "retrieve",
                "queryId": "yaxM3R8iZU2mJFD91lgTfw",
                "source": "TBD",
                "trigger": {
                    "id": 0,
                    "entity": "MatrixModule.Row"
                }
            }
         */
      // find last so that not all requests get linked to the first refresh
      matchingRefresh = refreshes.findLast((refresh) => {
        return refresh.guids.find((g, index) => {
          return reqContextGuids.find((rcg) => {
            if (g.substring(0, 5) === rcg.substring(0, 5)) {
              guidIndexMatch = index;
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
      trigger: matchingRefresh
        ? {
            id: matchingRefresh.id,
            entity: matchingRefresh.entities[guidIndexMatch],
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
        .map((dsc) => dsc.analysis.queryId);
      const downstreamCallsMap = downstreamCalls.reduce((total, current) => {
        // console.log(total);
        const existing = total.find((item) => item.id === current);
        if (existing) {
          existing.count += 1;
        } else {
          total.push({
            id: current,
            count: 1,
          });
        }
        return total;
      }, []);
      entityRefreshes.push({
        requestId: refresh.id,
        entity: entity,
        downStreamCallsCount: downstreamCalls.length,
        // downstreamCalls: downstreamCalls,
        downstreamCalls: downstreamCallsMap,
      });
    });
  });
  // console.log(entityRefreshes);
  const analysis = {
    refreshes: entityRefreshes,
  };
  fs.writeFileSync(
    "./out.json",
    JSON.stringify({
      summary: analysis,
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

// console.log(mxReqLog.filter(req => !req.analysis.trigger))

/**
 * i have a mysetery query: nRpEXDoBMUaf2RMl3xb1pg
 * - seems to be the result of a refreshed SubSection, but there's no instructions to do so..
 *
 *  */
