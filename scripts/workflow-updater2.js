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

async function getRateLimit() {
  const rateLimit = await octokit.rateLimit.get();
  return rateLimit.data.resources.core.remaining;
}

getRateLimit().then(remaining => {
  console.log(`Remaining API calls at the start: ${remaining}`);
}).catch(error => {
  console.error(error);
});

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
  let repoWorkflows = {};

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
                  const date = new Date(run.created_at);
                  const formattedDate = date.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: false
                  });
                  const linkText = `\n- [${workflow.name}-${formattedDate}-${run.status}](${url})`;

                  const statusColors = {
                    'completed': '2ea44f',
                    'action_required': 'yellow',
                    'cancelled': 'gray',
                    'failure': 'red',
                    'neutral': 'gray',
                    'skipped': 'gray',
                    'stale': 'gray',
                    'success': '2ea44f',
                    'timed_out': 'red',
                    'in_progress': 'yellow',
                    'queued': 'yellow',
                    'requested': 'yellow',
                    'waiting': 'blue',
                    'pending': 'yellow',
                    'no_runs': 'white'
                };
                let status;
                let runName;
                let runUrl;
                if (!runs.data.workflow_runs.length) {
                  status = 'no_runs';
                  runName = workflow_file;
                  runUrl = `https://github.com/${org}/${repo}/actions/workflows/${workflow_file}`;
                } else {
                  status = run.status === 'completed' ? (run.conclusion === 'success' ? 'success' : run.conclusion) : run.status;
                  runName = run.name;
                  runUrl = `https://github.com/${org}/${repo}/actions/runs/${run.id}`;
                }
                const color = statusColors[status] || 'white';
                const badge = `[![${runName} - ${status}](https://img.shields.io/static/v1?label=${runName.replace(/ /g, '%20')}&message=${status.replace(/ /g, '%20')}&color=${color})](${runUrl})`;
                const linkText2 = `\n-${badge}`;

                  if (!repoWorkflows[repo]) {
                      repoWorkflows[repo] = [];
                  }
                  repoWorkflows[repo].push(linkText);
                  repoWorkflows[repo].push(linkText2);
              }
          }
      } catch (error) {
          console.error(error);
      }
  }

  for (let repo in repoWorkflows) {
      const newContent = `\n## ${repo}\n\n` + repoWorkflows[repo] + '\n';
      console.log(newContent);
      fs.appendFileSync(filePath, newContent, 'utf8');
  }
}).catch(error => {
  console.error(error);
}).finally(() => {
  getRateLimit().then(remaining => {
    console.log(`Remaining API calls at the end: ${remaining}`);
  }).catch(error => {
    console.error(error);
  });
});



