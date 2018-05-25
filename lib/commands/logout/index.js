module.exports = {

    arguments: [
    ],

    exec: function({args, client}) {
        return client.logout();
    }
}
