import { constrainBoxTo, contains } from "./shape-math";

describe("contains", () => {
  it("returns true for points inside the box", () => {
    expect(
      contains({ top: 0, left: 0, bottom: 10, right: 10 }, { x: 5, y: 5 })
    ).toBe(true);
  });

  it("returns true for points on the edge of the box", () => {
    expect(
      contains({ top: 0, left: 0, bottom: 10, right: 10 }, { x: 0, y: 0 })
    ).toBe(true);
  });

  it("returns false for points outside the box", () => {
    expect(
      contains({ top: 0, left: 0, bottom: 10, right: 10 }, { x: 15, y: 15 })
    ).toBe(false);
  });
});

describe("constrainBoxTo", () => {
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
