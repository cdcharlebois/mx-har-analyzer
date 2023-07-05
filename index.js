/**
 * @todo
 * [ ] - extract the pages that are loaded from the HAR
 */
const fs = require("fs");
const command = process.argv[2];
const path = process.argv[3];
const { getPageDataStructure } = require("./modelsdk");
const { analyze } = require("./har-analyzer");

require("dotenv").config();

async function main() {
  function cmdAnalyze() {
    const har = JSON.parse(fs.readFileSync(path));
    const analysisResult = analyze(har);
    output = {
      ...output,
      analysisResult,
    };
  }
  async function cmdTree() {
    const { MENDIX_TOKEN, APP_ID, BRANCH, PAGE_NAME } = process.env;
    if (!MENDIX_TOKEN) {
      console.error(
        "Please provide a mendix token (MENDIX_TOKEN) in your .env file to use this operation"
      );
    }
    if (!APP_ID) {
      console.error(
        "Please provide an app id (APP_ID) in your .env file to use this operation"
      );
    }
    if (!BRANCH) {
      console.error(
        "Please provide a branch name (BRANCH) in your .env file to use this operation"
      );
    }
    if (!PAGE_NAME) {
      console.error(
        "Please provide a page name (PAGE_NAME) in your .env file to use this operation"
      );
    }
    if (MENDIX_TOKEN && APP_ID && BRANCH && PAGE_NAME) {
      try {
        const tree = await getPageDataStructure(
          MENDIX_TOKEN,
          APP_ID,
          BRANCH,
          PAGE_NAME
        );
        output = {
          ...output,
          tree,
        };
      } catch (e) {
        console.log(e);
      }
    }
  }
  let output;
  if (command === "analyze") {
    cmdAnalyze();
  } else if (command === "tree") {
    await cmdTree();
  } else if (command === "both") {
    cmdAnalyze();
    await cmdTree();
  }

  if (output) {
    fs.writeFileSync("./out.json", JSON.stringify(output));
  }
}

main();

/**
 * i have a mysetery query: nRpEXDoBMUaf2RMl3xb1pg
 * - seems to be the result of a refreshed SubSection, but there's no instructions to do so..
 * - showbycondition custom widget likely the refresh culprit
 *
 *  */
