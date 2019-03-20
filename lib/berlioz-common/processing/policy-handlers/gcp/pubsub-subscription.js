module.exports = ({gcp}) => {
    return {
        query: (id) => {
            return gcp.PubSub.getSubscriptionPolicy(id)
        },
        apply: (id, policy) => {
            return gcp.PubSub.setSubscriptionPolicy(id, policy)
        }
    }
}