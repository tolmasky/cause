const fail = require("@algebraic/type/fail");
const t = require("@babel/types");
const { getTraversableFields } = require("./custom-node");
const map = require("./map");
const Scope = require("./scope");


const vernacular = name =>
    name.replace(/(?!^)[A-Z](?![A-Z])/g, ch => ` ${ch.toLowerCase()}`);
const forbid = (...names) => Object.fromEntries(names
    .map(name => [name, () => fail.syntax(
        `${vernacular(name)}s are not allowed in concurrent functions.`)]));

module.exports = map(
{
    ...forbid(
        "AssignmentExpression",
        "BreakStatement",
        "ClassDeclaration",
        "ContinueStatement",
        "DoWhileStatement",
        "ForStatement",
        "ForInStatement",
        "ForOfStatement",
        "LabeledStatement",
        "WithStatement",
        "WhileStatement",
        "SwitchStatement"),

    Any(map, node)
    {
        const disambiguated = node;//disambiguateIdentifiers(node);
        const withUpdatedChildren = map.children(disambiguated);
        const children = Array.isArray(disambiguated) ?
            withUpdatedChildren :
            getTraversableFields(disambiguated)
                .map(field => withUpdatedChildren[field]);
        const scope = children
            .map(field => Scope.for(field))
            .reduce(Scope.concat, Scope.identity);
//console.log(scope);
        return Scope.with(withUpdatedChildren, scope);
    },

    Function(map, node)
    {
        const fReduced = map.as("Node", node);
        const bound = t.isStatement(fReduced) ?
            Scope.fromBound(fReduced.id.name) : Scope.identity;
        const scope = Scope.concat(bound,
            Scope.justFree(Scope.for(fReduced)));

        return Scope.with(fReduced, scope);
    },

    BlockStatement(map, statement)
    {
        const statements = map.children(statement.body);
        const scope = statements
            .map(statement => [statement, Scope.for(statement)])
            .map(([statement, scope]) =>
                // Block statements can only add to our free variables given
                // our NO-VAR-SCOPE ASSUMPTION.
                t.isBlockStatement(statement) ?
                    Scope.justFree(scope) :

                // Function declarations add to our free variables, but bind
                // their names.
                t.isFunctionDeclaration(statement) ?
                    Scope.concat(
                        Scope.justFree(scope),
                        Scope.fromBound(statement.id.name)) :

                // Everything else should be handled automatically, namely,
                // VariableDeclarations expose their bound and contribute
                // free variables.
                scope)
            .reduce(Scope.concat, Scope.identity);
        const updated = t.BlockStatement(statements);

        return Scope.with(updated, scope);
    },

    Statement (map, statement)
    {
        // This serves as a fallback for most statement types, which may
        // contain several scopes, like in the case of IfStatements with
        // a consequent and possible alternate, or TryStatements with
        // with block, handler, and finalizer.
        //
        // However, under the NO-VAR-SCOPE ASSUMPTION, none of these scopes
        // can influence eachother's bound variables, and they expose no
        // new bindings to their surroundings (except for VariableDeclaration,
        // which is not handled in this fallback).
        const updated = map.children(statement);
        const scope = getTraversableFields(statement)
            .map(key => Scope.justFree(Scope.for(updated[key])))
            .reduce(Scope.concat, Scope.identity);

        return Scope.with(updated, scope);
    },

    VariableDeclaration(map, declaration)
    {
        if (declaration.kind !== "const")
            return fail.syntax(
                `Only const declarations are allowed in concurrent functions`);
//console.log("HERE!");
        return map.as("Node", declaration);
    },

    IdentifierExpression(map, node)
    {//console.log("HERE expression");//Scope.with(node, Scope.fromFree(node.name)));
        return Scope.with(node, Scope.fromFree(node.name));
    },

    IdentifierPattern(map, pattern)
    {//console.log("HEREE! pattern");
        return Scope.with(pattern, Scope.fromBound(pattern.name));
    }
});
