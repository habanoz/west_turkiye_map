class MapBuilderBase {
    constructor() {
        if (new.target === MapBuilderBase) {
            throw new TypeError("Cannot construct Abstract instances directly");
        }
    }

    switch(){
        console.log("Abstract switch: Not expected");
    }

    render(){
        console.log("Abstract render: Not expected");
    }

    findVisible(tile, zoom, level, viewRect, visibleTiles){
        console.log("Abstract findVisible: Not expected");
    }
}

export default MapBuilderBase;