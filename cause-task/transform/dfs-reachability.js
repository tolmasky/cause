const DenseIntSet = require("./dense-int-set");


module.exports = function reachable(adjacencies)
{
    return adjacencies
        .map(set => DenseIntSet.toArray(set))
        .reduce((memoizations, _, node, adjacencies /*as arrays*/) =>
            (memoizations[node] =
                dfs(memoizations, adjacencies, node), memoizations),
            []);
}

function dfs(memoizations, adjacencies, node, visited = DenseIntSet.Empty)
{
    return  DenseIntSet.has(node, visited) ?
                visited :
            node < memoizations.length ?
                DenseIntSet.union(visited, memoizations[node]) :
            adjacencies[node].reduce((visited, node) =>
                dfs(memoizations, adjacencies, node, visited),
                DenseIntSet.union(visited, DenseIntSet.just(node)));
}
