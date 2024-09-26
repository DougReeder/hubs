import { paths } from "../systems/userinput/paths";

AFRAME.registerComponent("scalable-when-grabbed", {
  tick: function () {
    const userinput = AFRAME.scenes[0].systems.userinput;
    const interaction = AFRAME.scenes[0].systems.interaction;
    let deltaScale;
    if (interaction.state.rightRemote.held === this.el) {
      // console.log("scalable-when-grabbed: interaction.state.rightRemote.held === this.el", interaction.state.rightRemote.held)
      deltaScale = userinput.get(paths.actions.cursor.right.scaleGrabbedGrabbable);
    }
    if (interaction.state.leftRemote.held === this.el) {
      deltaScale = userinput.get(paths.actions.cursor.left.scaleGrabbedGrabbable);
    }
    if (!deltaScale) return;

    console.log("scaling", this.el, "by", deltaScale);
    this.el.object3D.scale.addScalar(deltaScale).clampScalar(0.1, 100);
    this.el.object3D.matrixNeedsUpdate = true;
  }
});
