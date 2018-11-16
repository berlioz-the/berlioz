const Promise = require('the-promise');
const _ = require('the-lodash');

module.exports = (section, logger, {docker, helper, cluster}) => {

    section
        .onExtractNaming(obj => obj.naming)
        .onExtractIdFromNaming(naming => naming)
        .onExtractId(obj => obj.naming)
        .onQuery(id => ({
            naming: id
        }))
        .onExtractConfig(obj => {
            return obj;
        })
        .onExtractRelations(item => {
        })
        .onCreate(delta => {
            var task = delta.findRelation('task').targetItem;
            return Promise.resolve()
                .then(() => delta.obj);
        })
        .onUpdateRecreate(delta => {
            if (delta == null) {
                return true;
            }
            return false;
        })
        // .onDelete(delta => {
        //     return stopTask(delta);
        // })
        ;
}
