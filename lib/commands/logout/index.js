module.exports = {

    useClient: true,

    arguments: [
    ],

    exec: function({args, client}) {
        return client.logout();
    }
}
