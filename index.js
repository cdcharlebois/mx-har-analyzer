const fs = require('fs');
// const file = 

// let har;
// fs.readFile('file', 'utf8', function (err, data) {
//     if (err) throw err;
//     har = JSON.parse(data);
// });

const path = process.argv[2];
const har = require(path);
const requests = har.log.entries.filter(entry => {
    return entry.request.method === "POST" && /xas\/$/.test(entry.request.url)
})
    .map(entry => ({
        request: entry.request,
        response: entry.response
    }));
console.log(requests.length);
let refreshes = [];
const mxReqLog = requests.map((req, index) => {
    let ret = {};

    const { text } = req.request.postData;
    const { action, params } = JSON.parse(text);
    ret.request = {
        action, params, queryId: params.queryId,
    }
    const responseText = req.response.content.text;
    const { changes, commits, instructions, objects } = JSON.parse(responseText)
    const refreshInClient = instructions && instructions.find(instr => {
        return instr.type == "refresh_class"
    })
    if (refreshInClient) {
        refreshes.push({
            id: index,
            entities: refreshInClient.args.classnames,
            guids: instructions.find(instr => {
                return instr.type == "refresh_object_list"
            }).args.ObjectIds
        })
    }
    ret.response = {
        changes, commits, instructions,
        objects: objects.map(fullObj => ({ guid: fullObj.guid, objectType: fullObj.objectType }))
    }
    let matchingRefresh;
    let guidIndexMatch;
    if (action === "retrieve") {
        const reqContextGuids = []
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
        matchingRefresh = refreshes.findLast(refresh => {
            return refresh.guids.find((g, index) => {
                return reqContextGuids.find(rcg => {
                    if (g.substring(0, 5) === rcg.substring(0, 5)) {
                        guidIndexMatch = index;
                        return true;
                    }
                    return false;
                })
            })
        })
    }

    ret.analysis = {
        id: index,
        action: action,
        queryId: params.queryId,
        source: 'TBD',
        trigger: matchingRefresh ? {
            id: matchingRefresh.id,
            entity: matchingRefresh.entities[guidIndexMatch]
        }
            : undefined
    }
    return ret;
})

const entityRefreshes = [];
refreshes.forEach(refresh => {
    refresh.entities.forEach(entity => {
        const downstreamCalls = mxReqLog.filter(req => {
            return req.analysis.trigger && req.analysis.trigger.id === refresh.id
                && req.analysis.trigger.entity === entity 
        }).map(dsc => dsc.analysis.queryId);
        const downstreamCallsMap = downstreamCalls.reduce((total, current) => {
            // console.log(total);
            const existing = total.find(item => item.id === current)
            if (existing){
                existing.count += 1
            } else {
                total.push({
                    id: current,
                    count: 1
                })
            }
            return total;
        }, []);
        entityRefreshes.push({
            requestId: refresh.id,
            entity: entity,
            downStreamCallsCount: downstreamCalls.length,
            // downstreamCalls: downstreamCalls,
            downstreamCalls: downstreamCallsMap

        })
    })
})
// console.log(entityRefreshes);
const analysis = {
    refreshes: entityRefreshes
}
fs.writeFileSync('./out.json', JSON.stringify({
    summary: analysis,
    data: mxReqLog
}));



console.log(mxReqLog.filter(req => !req.analysis.trigger))
console.log(mxReqLog.filter(req => !req.analysis.trigger).length)
/**
 * i have a mysetery query: nRpEXDoBMUaf2RMl3xb1pg
 * - seems to be the result of a refreshed SubSection, but there's no instructions to do so..
 * 
 *  */ 
