const debug = require('debug')('netlify-cli:deploy')
const uploadFiles = require('./upload-files')
const hashFiles = require('./hash-files')
const hashFns = require('./hash-fns')

const { waitForDeploy, getUploadList, defaultFilter } = require('./util')

module.exports = async (api, siteId, dir, fnDir, tomlPath, opts) => {
  // TODO Implement progress cb
  opts = Object.assign(
    {
      deployTimeout: 1.2e6, // 20 mins
      concurrentHash: 100, // concurrent file hash calls
      concurrentUpload: 4, // Number of concurrent uploads
      filter: defaultFilter,
      statusCb: statusObj => {
        /* noop */
        /* statusObj: {
            type: name-of-step
            msg: msg to print
            phase: [start, progress, stop]
        } */
      }
    },
    opts
  )

  const [{ files, filesShaMap }, { functions, fnShaMap }] = await Promise.all([
    hashFiles(dir, tomlPath, opts),
    hashFns(fnDir, opts)
  ])

  debug(`Hashed ${Object.keys(files).length} files`)
  debug(`Hashed ${Object.keys(functions).length} functions`)

  opts.statusCb({
    type: 'create-deploy',
    msg: 'Creating site deploy...',
    phase: 'start'
  })

  let deploy = await api.createSiteDeploy({ siteId, body: { files, functions } })
  const { id: deployId, required: requiredFiles, required_functions: requiredFns } = deploy

  debug(`deploy id: ${deployId}`)
  debug(`deploy requested ${requiredFiles.length} site files`)
  debug(`deploy requested ${requiredFns.length} function files`)
  opts.statusCb({
    type: 'create-deploy',
    msg: `Site deploy requesting ${requiredFiles.length} files and ${requiredFns.length} functions`,
    phase: 'stop'
  })

  const uploadList = getUploadList(requiredFiles, filesShaMap).concat(getUploadList(requiredFns, fnShaMap))

  debug(`Deploy requested ${uploadList.length} files`)
  await uploadFiles(api, deployId, uploadList, opts)
  debug(`Done uploading files.`)

  debug(`Polling deploy...`)
  opts.statusCb({
    type: 'wait-for-deploy',
    msg: 'Waiting for deploy to go live...',
    phase: 'start'
  })
  deploy = await waitForDeploy(api, deployId, opts.deployTimeout)
  debug(`Deploy complete`)
  opts.statusCb({
    type: 'wait-for-deploy',
    msg: 'Deploy is live!',
    phase: 'stop'
  })

  const deployManifest = {
    deployId,
    deploy,
    uploadList
  }
  return deployManifest
}
