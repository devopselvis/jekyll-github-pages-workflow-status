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

// Output workflow URL to command line
getWorkflowUrls().then(workflowUrls => {
  console.log(workflowUrls.join('\n'));
}).catch(error => {
  console.error(error);
});