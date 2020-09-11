
function createSettingObject(name, defaultProps) {
    const originalObject = Object.assign(
        { $listen: true },
        defaultProps,
        JSON.parse(localStorage.getItem(name) ?? '{}'),
    )
    const object = new Proxy(originalObject, {
        set(target, p, value, receiver) {
            Reflect.set(target, p, value, receiver)
            if (target.$listen && p !== '$listen') {
                const write = {
                    ...object
                }
                delete write.$listen
                localStorage.setItem(name, JSON.stringify(write))
            }
            return true
        }
    })
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
