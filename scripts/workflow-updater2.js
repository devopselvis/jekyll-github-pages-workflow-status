const fs = require('fs');
const { Octokit } = require("@octokit/rest");
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const argv = yargs(hideBin(process.argv)).argv;

const octokit = new Octokit({ auth: process.env.WORKFLOW_GITHUB_TOKEN });

const org = 'devopselvis'; // Replace with your organization name

async function getWorkflowUrls() {
    const repos = await octokit.repos.listForOrg({
        org
    });

    let workflowUrls = [];

    for (let repo of repos.data) {
        const workflows = await octokit.actions.listRepoWorkflows({
            owner: org,
            repo: repo.name
        });

        for (let workflow of workflows.data.workflows) {
            const workflowUrl = `https://github.com/${org}/${repo.name}/actions/workflows/${workflow.path}`;
            workflowUrls.push(workflowUrl);
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
                  console.log(`URL: ${url}, Date: ${run.created_at}, Status: ${run.status}`);
              }
          }
      } catch (error) {
          console.error(error);
      }
  }
}).catch(error => {
  console.error(error);
});



