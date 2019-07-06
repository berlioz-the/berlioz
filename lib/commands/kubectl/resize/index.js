module.exports = {

    useClient: true,
    useGcpHelper: true,

    arguments: [
        "region",
        "deployment",
        "size"
    ],

    exec: function({args, logger, screen, gcpHelper}) {
        return gcpHelper.kubernetesResize(args.deployment, args.region, args.size);
    }

}
