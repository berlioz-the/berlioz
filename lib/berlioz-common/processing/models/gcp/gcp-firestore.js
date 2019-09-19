module.exports = (section, logger, {Promise, _, helper, gcp, gcpAccountId, deployment, cluster, region}) => {
    section
        .onQueryAll(() => {
            return [];
        })
        .onExtractNaming(obj => obj.naming)
        .onExtractId(obj => obj.naming)
        .onQuery(id => ({ naming: id }))
        .onExtractConfig(obj => { 
            return {
            };
        })
        .markUseDefaultsForDelta()
        .onCreate(delta => {
            return {
                naming: delta.naming
            }
        })
        ;

}
