mx-har-analyzer
===
A tool to analyze the xas network traffic from a mendix app.

use cases
---
Use this tool when you have a page that loads slowly and/or seems to trigger too many xas requests. This tool will help identify the sources of the xas requests on your page.

installation
---
1. clone this repository
2. run `npm install` in the repository root
3. run the [command](#commands) you want

commands
---

> All commands generate output in a file called `out.json` in the repository root.

`analyze`: given a .har file, analyze the traffic and determine the sources of each call. For this to run, you must provide the path to the .har file in the command line invocation:
```sh
npm run analyze <path/to/har/file>
```

`tree`: view the structure of the data elements on a page from the model, along with the data source for each. For this to run, you must create a `.env` file in the repository root with the following variables:
- `MENDIX_TOKEN`: your mendix token from sprintr (must have read access to your repository)
- `APP_ID`: the app id to inspect
- `BRANCH`: the branch of the model to inspect
- `PAGE_NAME`: the qualified (i.e. include the module name) name of the page to view

```bash
npm run tree
```

`start`: run both `analyze` and `tree` and generate combined output. For this to run, you must provide all the inputs to both commands.
```
npm run start <path/to/har/file>
```


notes
---
```
At a high level, this is what we're looking for:

a refresh_class that causes a bunch of other retrieves
- a refresh_class followed by one/more retrieves where the CurrentObject's guid matches the class
- match the first N digits of the guid?

map queryId to xpath or other retrieve (type?)
```