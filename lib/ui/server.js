
var express = require('express');
var Path = require('path');
var port = 3000;
var Promise = require('the-promise');
var _ = require('the-lodash');



module.exports = function (dataProvider) {

    var app = express();

    var bodyParser = require("body-parser");
    //Here we are configuring express to use body-parser as middle-ware.
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());


    // Temporarily removed reloadify.
    // var reloadify = require('reloadify')(__dirname);
    // app.use(reloadify);

    app.use(express.static('static'));
    app.set('views', Path.join(__dirname, 'views'));
    app.set('view engine', 'ejs');

    //requesting regions
    app.get('/', (req, res) => {
        console.log("[regions] begin")
        var renderData = {
            regions: [{ name: "uninitialized", provider: "uninitialized" }]
        };

        dataProvider.getRegions()
            .then(regions => {
                console.log("[regions] inside getRegions")
                renderData.regions = regions;
            })
            .then(() => {
                res.render('index', renderData);
            })

        console.log("[regions] end")
    });


    //requesting deployments for specific region
    app.get('/regions/:region', (req, res) => {
        console.log("[region][deployments] begin")
        var renderData = {
            region: req.params.region,
            deployments: [{ name: "uninitialized" }]
        }

        dataProvider.getDeployments(renderData.region)
            .then(deployments => {
                console.log("[region] inside getDeployments")
                renderData.deployments = deployments;
            })
            .then(() => {
                res.render('region', renderData);
                console.log("[region][deployments] render")
            })

        console.log("[region][deployments] end")
    })


    //requesting clusters for specific deployment
    app.get('/regions/:region/:deployment', (req, res) => {
        console.log("[region][deployment][clusters] begin")

        var renderData = {
            region: req.params.region,
            deployment: req.params.deployment,
            clusters: [{ name: "uninitialized" }]
        }

        dataProvider.getClusters(renderData.region, renderData.deployment)
            .then(clusters => {
                console.log("[region][deployment][clusters] inside getClusters")
                renderData.clusters = clusters;
            })
            .then(() => {
                res.render('deployment', renderData);
                console.log("[region][deployment][clusters] render")
            })

        console.log("[region][deployment][clusters] end")
    })

    app.get('/regions/:region/:deployment/:cluster', (req, res) => {
        console.log("[region][deployment][clusters][cluster] begin")

        var renderData = {
            region: req.params.region,
            deployment: req.params.deployment
        }

        dataProvider.getCluster(req.params)
            .then((cluster) => {
                console.log("[region][deployment][clusters][cluster] begin");
                renderData.cluster = cluster;
            })
            .then(() => dataProvider.getDefinitions(req.params))
            .then(result => {
                renderData.definitions = [];
                if (result) {
                    renderData.definitions = result.map(x => JSON.stringify(x, null, 4));
                }
            })
            .then(() => {
                console.log("[region][deployment][clusters][cluster] render")
                res.render('cluster', renderData);
            })

        console.log("[region][deployment][clusters][cluster] end")

    })

    app.get('/regions/:region/:deployment/:cluster/diagram', (req, res) => {

        dataProvider.getDiagram(req.params)
            .then(imgPath => {
                res.sendFile(imgPath);
            })
    })

    app.post('/regions/:region/:deployment/:cluster/perform/:action', (req, res) => {

        console.log(`**** perform action ${req.params.action} `)
        console.log(req.params)

        console.log("cluster = " + req.params.cluster);

        return new Promise.resolve()
            .then(() => dataProvider.performAction(req.params) )
            .then(result => {
                console.log("performAction in promise");
                res.redirect(`/regions/${req.params.region}/${req.params.deployment}/${req.params.cluster}/action/${req.params.action}/${result.id}`);
            })
            .catch(reason => {
                console.log(reason);
            })
    })


    //redirect to action status
    app.get('/regions/:region/:deployment/:cluster/action/:name/:id', (req, res) => {

        console.log(`**** get action performed ${req.params.name} `)
        console.log(req.params)

        console.log("cluster = " + req.params.cluster);

        var renderData = {
            region: req.params.region,
            deployment: req.params.deployment,
            cluster: req.params.cluster,
            action: req.params.name,
            id: req.params.id,
        }
        //res.send(req.params);
        dataProvider.getActionStatus(req.params)
            .then(result => {
                renderData.status = result.status;
                renderData.error = 'the-error-goes-here';
                renderData.message = {
                    msg: "hghghjg"
                }
                res.render('action_status', renderData);
            })
    })

    //redirect to action status
    app.get('/api/:region/:deployment/:cluster/action/:name/:id/status', (req, res) => {

        console.log(`**** get action performed ${req.params.name} `)
        console.log(req.params)

        console.log("cluster = " + req.params.cluster);

        dataProvider.getActionStatus(req.params)
            .then(result => {
                res.send(result);
            })
    })


    //redirect to action status
    app.get('/api/:region/:deployment/:cluster/action/:name/:id/logs', (req, res) => {

        dataProvider.getScreenMessage(req.params, req.query)
            .then(result => {
                var data = {
                    logs: result
                }
                data.next = _.max(result.map(x => x.index));
                if (!data.next) {
                    if (req.query.next) {
                        data.next = req.query.next;
                    }
                }
                res.send(data);
            })
    })

    app.listen(port);
    console.log(`${port} is the magic port`);

    console.log(process.cwd());

}