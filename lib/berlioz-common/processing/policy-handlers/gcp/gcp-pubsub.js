module.exports = ({gcp}) => {
    return {
        query: (id) => {
            return gcp.PubSub.getTopicPolicy(id)
        },
        apply: (id, policy) => {
            return gcp.PubSub.setTopicPolicy(id, policy)
        }
    }
}