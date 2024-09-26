AFRAME.registerComponent("inspect-button", {
  tick() {
    if (!this.initializedInTick) {
      // initialize in tick so that parent's `tags` component has been initialized
      this.initializedInTick = true;
      console.log("inspect: adding 'holdable-button-down' to", this.el.object3D.id, this.el)
      this.el.object3D.addEventListener("holdable-button-down", () => {
        console.log("inspect-button: holdable-button-down", this.el)
        this.el.sceneEl.systems["hubs-systems"].cameraSystem.inspect(this.el.object3D, 1.5);
      });
      this.el.object3D.addEventListener("holdable-button-up", () => {
        console.log("inspect-button: holdable-button-up", this.el)
        this.el.sceneEl.systems["hubs-systems"].cameraSystem.uninspect();
      });
    }
  }
});
