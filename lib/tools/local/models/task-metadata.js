const Promise = require('the-promise');
const Path = require('path');
const _ = require('the-lodash');

module.exports = (section, logger, {docker, helper, cluster}) => {

    section
        .onQueryAll(() => {
            return Promise.resolve(helper.storage.listDirectories(helper.getTaskMetadataWorkingPath()))
                .then(dirs => Promise.serial(dirs, x => query(x.name)))
        })
        .onExtractNaming(obj => obj.naming)
        .onExtractIdFromNaming(naming => naming[0])
        .onExtractId(obj => obj.naming[0])
        .onQuery(id => {
            return query(id);
        })
        .onExtractConfig(obj => ({
            contents: obj.contents
        }))
        .onAutoConfig((item, action) => {
            logger.info('TASK-METADATA::onAutoConfig %s...', item.dn);

            if (action == 'delete') {
                return true;
            }

            item.config.contents = helper.nativeProcessor.produceMetadataDirStructure(item);
            if (!item.config.contents) {
                logger.info('TASK-METADATA::onAutoConfig %s Contents are MISSING.', item.dn);
                return false;
            } else {
                logger.info('TASK-METADATA::onAutoConfig %s Contents are PRESENT.', item.dn, item.config.contents);
            }

            return true;
        })
        .onCreate(delta => {
            return setup(delta, delta.config.contents, {});
        })
        .onUpdate(delta => {
            logger.info("TASK METADATA ONUPDATE %s ... ", delta.dn, delta.delta);
            if ('contents' in delta.delta.configs) {
                return setup(delta, delta.delta.configs.contents.value, delta.delta.configs.contents.oldValue)
            }
        })
        .onDelete(delta => {
            var full_path = makeFullPath(delta.naming[0]);
            return helper.storage.deleteDirectory(full_path);
        })
        ;

    function query(name)
    {
        var full_path = makeFullPath(name);
        return helper.storage.readDirWithContents(full_path, { excludeParentDir: true })
            .then(contents => {
                return {
                    name: name,
                    naming: [name],
                    full_path: full_path,
                    contents: contents
                };
            });
    }

    function makeFullPath(name)
    {
        return helper.getTaskMetadataWorkingPath(name);
    }

    function setup(delta, newContents, oldContents)
    {
        logger.info("TASK METADATA SETUP %s. ID: %s ... ", delta.dn, delta.id);

        return Promise.resolve()
            .then(() => {

                var diff = [];
                for(var x of _.keys(oldContents))
                {
                    if (!newContents[x]) {
                        diff.push({
                            present: false,
                            item: x
                        })
                    }
                }
                for(var x of _.keys(newContents))
                {
                    var newContent = newContents[x];
                    var oldContent = oldContents[x];

                    if (!oldContent) {
                        diff.push({
                            present: true,
                            item: x,
                            contents: newContent
                        })
                    } else {
                        if (newContent !== oldContent) {
                            diff.push({
                                present: true,
                                item: x,
                                contents: newContent
                            })
                        }
                    }
                }

                logger.debug("TASK METADATA SETUP %s, DIFF: ", delta.dn, diff);

                var full_path = makeFullPath(delta.naming[0]);
                return helper.storage.syncDirectory(full_path, diff);
            })
            .then(() => query(delta.naming[0]))
            ;
    }
}
