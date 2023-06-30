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
    if (action === "retrieve"){
        const reqContextGuids = []
        for (const key in params.params) {
            reqContextGuids.push(params.params[key].guid);
        }
        /** 
         * @TODO in this test case there are two matching refreshes and it's showing the first one always.
         */
        matchingRefresh = refreshes.find(refresh => {
            return refresh.guids.find(g => {
                return reqContextGuids.find(rcg => {
                    return g.substring(0,5) === rcg.substring(0,5)
                })
            })
        })
    }
    
    ret.analysis = {
        id: index,
        action: action,
        queryId: params.queryId,
        source: 'TBD',
        trigger: matchingRefresh ? matchingRefresh.id : undefined
    }
    return ret;
})
console.log(refreshes);
// console.log(mxReqLog);
fs.writeFileSync('./out.json', JSON.stringify(mxReqLog));