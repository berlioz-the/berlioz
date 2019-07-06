module.exports = {

    useClient: true,
    useGcpHelper: true,

    arguments: [
        "region",
        "deployment",
    ],

    exec: function({args, logger, screen, _, shell, gcpHelper}) {

        return gcpHelper.gcloudAuthorize(args.deployment)
            .then(authResult => {
                var k8sClusterName = gcpHelper.getMyK8sClusterName(args.deployment, args.region);
                var gcloudArgs = ['container', 'clusters', 'get-credentials', k8sClusterName];
                gcloudArgs = _.concat(gcloudArgs, gcpHelper.getZoneParams(args.region));
                gcloudArgs = _.concat(gcloudArgs, ['--project', authResult.project_id]);
                return shell.runGCloud(gcloudArgs);
            })
    }

}
