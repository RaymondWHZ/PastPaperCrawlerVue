/*

This file implements a global setting object.

If multiple objects are created in different places but with same
name, their properties will be synchronized automatically.

 */


function createSettingObject(name, defaultProps) {
    const originalObject = Object.assign(
        { $listen: true  /* the variable controls whether changes to this object should be reported */ },
        defaultProps,
        JSON.parse(localStorage.getItem(name) ?? '{}'),  // loading setting from storage, may replace default props
    )
    const object = new Proxy(originalObject, {
        set(target, p, value, receiver) {
            // apply change
            Reflect.set(target, p, value, receiver)

            // if available, write the new setting object to localStorage
            if (target.$listen && p !== '$listen') {
                const write = {  // copy object
                    ...object
                }
                delete write.$listen
                localStorage.setItem(name, JSON.stringify(write))
            }

            return true
        }
    })
    // listen to storage change
    // if relevant to this object
    // pull changes to this object
    window.addEventListener('storage', ev => {
        if (ev.key === name) {
            object.$listen = false
            Object.assign(object, JSON.parse(ev.newValue))
            object.$listen = true
        }
    })
    return object
}

module.exports = {
    createSettingObject,
}
