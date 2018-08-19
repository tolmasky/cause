const { Record } = require("immutable");
const type = state => Object.getPrototypeOf(state).constructor;


module.exports = Object.assign(update, { in: updateIn });

function update(state, event, source)
{
    const update = type(state).update;

    if (!update)
        return [state, [event]];

    return update(state, event, source);
}

function updateIn(state, path, event, source)
{//console.log(arguments);
    const pathArray = typeof path === "string" ? [path] : Array.from(path);

    return updateInWithIndex(state, pathArray, 0, event, source);
}

function updateInWithIndex(state, path, index, event, source)
{
    if (index >= path.length)
        return update(state, event, source);
/*
    if (!(state instanceof Record))
    {
        console.log("NOPE: " + state);
    }*/

    const component = path[index];
    const child = state.get(component);
    const [updatedChild, events] =
        updateInWithIndex(child, path, index + 1, event, source);
    const updated = state.set(component, updatedChild);

    return events.reduce(function ([state, coallesced], event)
    {
        const [updated, events] = update(state, event, source);
        
        return [updated, [...coallesced, ...events]];
    }, [updated, []]);
}




/*const type = object => Object.getPrototypeOf(state).constructor;

module.exports = function ()
{
    
}


function update(state, event)
{
    const etype = type(event);
    
    if (etype !== ExternalEvent)
        return updateIn();
    
    const paths = from();
    
    paths.reduce(
        updateIn(state, path, event, source));

        
        
ExternalEvent

if (type
const path = []

update.in(state, path, event, source)
}


function updateIn(state, path, event)
{
    return updateIn(state, path, 0, event);
}

start, a, b

["a", "b"]

        |
        v
start, ["a", "b"], 0

start.get("a"), ["b"]

a.get("b"), []


a, ["a", "b"], 1
b, ["a", "b"], 2 


function updateIn(state, path, index, event, context)
{
    if (index >= path.length - 1)
        return update(state, event, context);

    const component = path[index];
    const child = state.get(component);
    const [updatedChild, events] = updateIn(child, index + 1, event, context);
    const updated = state.set(component, updatedChild);

    return events.reduce(function ([state, coallesced], event)
    {
        const [updated, events] = update(state, event, context);
        
        return [updated, [coallesced, ...events]];
    }, [updated, []]);
}

function update(state, event, { source })
{
    const stype = type(state);
    const etype = type(event);
    const match = stype.cases
        .find(candidate => candidate.condition(event, source))

    if (!match)
        throw new Error("!!!");

    const result = match.update(state, event, { source });

    return isArray(result) ? result : [result, []];
}




    if (path.length - 1 > index)
    {
        const result = updateIn(state.get(path[index]), path, index + 1, event, { source });
        
        
        
    }


    return update(state, event);

    const result = update(state, event);
    const [updated, event] = isArray(result) ? result : [result];  

    if (path.length - 1 === index)
    
    update(state, event)


    return path.reduce(([state, events], component) => 
    {
        const result = update(state, event);
        const [updated, event] = isArray(result) ? result : [result];

        
    }, );

    result = update(state, ))
}

function toStateAndEvents(result)
{
    return Array.isArray(result) ? result : [result, []]
}*/

