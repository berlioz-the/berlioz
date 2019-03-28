
module.exports = {

    useClient: true,

    arguments: [
    ],

    flags: [
        'json'
    ],

    fetch: function({args, client, screen}) {
        return client.getMaster('/deployment');
    },

    exec: function({args, client, screen, result}) {
        if (args.json) {
            screen.info(JSON.stringify(result));
            return result;
        }
        screen.table(['Name', 'Provider'])
            .addRange(result, x => [x.name, x.provider])
            .output();
    }

}
