import React, { ReactElement } from "react";

export default function noBorder(story: () => ReactElement): ReactElement {
  document.body.style.margin = "0px";
  return (
    <>
      <style>{`
      body {
       margin 0
      }
      `}</style>
      {story()}
    </>
  );
}
