# job-builder

A GitHub action to setup job matrixes for complex job workflows.

> [!NOTE]
> This action is designed to be used in conjunction with a reusable workflow. It generates a job matrix based on the provided build options JSON file, allowing for flexible and dynamic job configurations.

## How to use

### workflow

```yaml
name: Build Jobs
on:
  push:
    branches:
      - main
  pull_request:
    branches:
      - main
jobs:
  setup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          sparse-checkout: |
            path/to/build-options.json
      - uses: RageAgainstThePixel/job-builder@v1
        id: job-builder
        with:
          build-options: 'path/to/build-options.json'
          group-by: 'os' # Optional, defaults to the first property in the build options object
        job-name-prefix: 'Build' # Optional, defaults to empty string
    outputs:
      jobs: ${{ steps.job-builder.outputs.jobs }}
  build:
    if: ${{ needs.setup.outputs.jobs }}
    needs: setup
    name: ${{ matrix.jobs.name }}
    strategy:
      matrix: ${{ fromJSON(needs.setup.outputs.jobs) }}
    uses: path/to/reusable/workflow.yml
    with:
      matrix: ${{ toJSON(matrix.jobs.matrix) }}
```

### inputs

| name | description | required |
| ---- | ----------- | -------- |
| `build-options` | The path to the build options JSON file. | true |
| `group-by` | The property to group jobs by. Defaults to the first property in the build options object. | false |
| `job-name-prefix` | The prefix to use for job names. Defaults to empty string. | false |

### outputs

- `jobs`: The JSON string of the job matrix.

#### build options json output example

```json
{
  "jobs": [
    {
      "name": "Group Name",
      "matrix": {
        "include": [
          {
            "name": "Job Name",
            "os": "windows-latest",
            "build-target": "WSAPlayer",
            "unity-version": "6000.0.49f1 (840e0a9776d9)",
            ... // other custom properties defined in the build options
          },
          ...
          {
            "name": "Job Name",
            "os": "windows-latest",
            "build-target": "WindowsStandalone64",
            "unity-version": "6000.0.49f1 (840e0a9776d9)",
            ... // other custom properties defined in the build options
          }
        ]
      }
    }
  ]
}
```
