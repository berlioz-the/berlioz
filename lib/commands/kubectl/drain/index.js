module.exports = {

    useClient: true,
    useGcpHelper: true,

    arguments: [
        "region",
        "deployment"
    ],

    exec: function({args, logger, screen, gcpHelper}) {
        return gcpHelper.kubernetesResize(args.deployment, args.region, 0);
    }

}
