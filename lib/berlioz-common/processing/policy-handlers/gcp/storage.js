module.exports = ({gcp, projectId, nativeProcessor}) => {
    return {
        query: (id) => {
            return gcp.Storage.getBucketPolicy(id)
        },
        apply: (id, policy) => {
            return gcp.Storage.setBucketPolicy(id, policy)
        },
        setupDefault: (item) => {
            return Promise.resolve()
                .then(() => nativeProcessor.setupTargetPolicyRoleId(item, 'roles/storage.legacyBucketOwner', 'projectEditor', projectId))
                .then(() => nativeProcessor.setupTargetPolicyRoleId(item, 'roles/storage.legacyBucketOwner', 'projectOwner', projectId))
                .then(() => nativeProcessor.setupTargetPolicyRoleId(item, 'roles/storage.legacyBucketReader', 'projectViewer', projectId));
        }
    }
}