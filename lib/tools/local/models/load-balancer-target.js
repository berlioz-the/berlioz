const Promise = require('the-promise');
const _ = require('the-lodash');

module.exports = (section, logger, {docker, helper, cluster}) => {

    section
        .onQueryAll(() => [])
        .markIgnoreDelta()
        ;
}
