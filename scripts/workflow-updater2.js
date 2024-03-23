const fs = require('fs');
const { Octokit } = require("@octokit/rest");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

const octokit = new Octokit({ auth: process.env.WORKFLOW_GITHUB_TOKEN });

const filePath = argv.filePath || '../docs/workflow-status2.md'; // Use the filePath argument or default to '../docs/workflow-status.md'
const content = fs.readFileSync(filePath, 'utf8');
let updatedContent = content;

const org = 'devopselvis'; // Replace with your organization name

async function getWorkflowUrls() {
  let workflowUrls = [];
  let page = 1;
  let hasNextPage = true;

  while (hasNextPage) {
      const repos = await octokit.repos.listForOrg({
          org,
          per_page: 100,
          page: page
      });

      for (let repo of repos.data) {
          let workflowPage = 1;
          let hasWorkflowNextPage = true;

          while (hasWorkflowNextPage) {
              const workflows = await octokit.actions.listRepoWorkflows({
                  owner: org,
                  repo: repo.name,
                  per_page: 100,
                  page: workflowPage
              });

              for (let workflow of workflows.data.workflows) {
                  const workflowUrl = `https://github.com/${org}/${repo.name}/actions/workflows/${workflow.path}`;
                  workflowUrls.push(workflowUrl);
              }

              if (workflows.data.workflows.length < 100) {
                  hasWorkflowNextPage = false;
              } else {
                  workflowPage++;
              }
          }
      }

      if (repos.data.length < 100) {
          hasNextPage = false;
      } else {
          page++;
      }
  }

  return workflowUrls;
}

// let workflowUrls = await getWorkflowUrls();

let workflowUrls = getWorkflowUrls();

getWorkflowUrls().then(async workflowUrls => {
  for (let url of workflowUrls) {
      const parts = url.split('/');
      const org = parts[3];
      const repo = parts[4];
      const workflow_file = parts.slice(7).join('/');

      try {
          const workflows = await octokit.actions.listRepoWorkflows({
              owner: org,
              repo: repo
          });
          const workflow = workflows.data.workflows.find(w => w.path === workflow_file);

          if (workflow) {
              const runs = await octokit.actions.listWorkflowRuns({
                  owner: org,
                  repo: repo,
                  workflow_id: workflow.id,
                  per_page: 1
              });

              if (runs.data.workflow_runs.length > 0) {
                  const run = runs.data.workflow_runs[0];
                  const newContent = `URL: ${url}, Date: ${run.created_at}, Status: ${run.status}`;
                  console.log(newContent);
                  fs.appendFileSync(filePath, newContent, 'utf8');
              }
          }
      } catch (error) {
          console.error(error);
      }
  }
}).catch(error => {
  console.error(error);
});



