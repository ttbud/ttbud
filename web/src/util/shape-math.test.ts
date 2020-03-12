import { constrainBoxTo } from "./shape-math";

describe("constrainTo", () => {
  it("Does not move the box if it is already inside", () => {
    const constrained = constrainBoxTo(
      { top: 10, left: 10, bottom: 20, right: 20 },
      { top: 0, left: 0, bottom: 50, right: 50 }
    );

    expect(constrained).toEqual({ top: 10, left: 10, bottom: 20, right: 20 });
  });

  it("Moves the box up if necessary", () => {
    const constrained = constrainBoxTo(
      { top: 20, left: 0, bottom: 30, right: 10 },
      { top: 10, left: 0, bottom: 20, right: 10 }
    );

    expect(constrained).toEqual({ top: 10, left: 0, bottom: 20, right: 10 });
  });

  it("Moves the box down if necessary", () => {
    const constrained = constrainBoxTo(
      { top: 0, left: 0, bottom: 10, right: 10 },
      { top: 10, left: 0, bottom: 20, right: 10 }
    );

    expect(constrained).toEqual({ top: 10, left: 0, bottom: 20, right: 10 });
  });

  it("Moves the box right if necessary", () => {
    const constrained = constrainBoxTo(
      { top: 0, left: 0, bottom: 10, right: 10 },
      { top: 0, left: 10, bottom: 10, right: 20 }
    );

    expect(constrained).toEqual({ top: 0, left: 10, bottom: 10, right: 20 });
  });

  it("Moves the box left if necessary", () => {
    const constrained = constrainBoxTo(
      { top: 0, left: 10, bottom: 10, right: 20 },
      { top: 0, left: 0, bottom: 10, right: 10 }
    );

    expect(constrained).toEqual({ top: 0, left: 0, bottom: 10, right: 10 });
  });

  it("Only constrains dimensions outside the bounds", () => {
    const constrained = constrainBoxTo(
      { top: 0, left: 0, bottom: 10, right: 10 },
      { top: 10, left: 0, bottom: 20, right: 20 }
    );

    expect(constrained).toEqual({ top: 10, left: 0, bottom: 20, right: 10 });
  });
});
