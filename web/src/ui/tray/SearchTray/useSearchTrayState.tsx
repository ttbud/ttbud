import { useCallback, useMemo, useState } from "react";
import { Blueprint } from "../CharacterTray/CharacterTray2";
import {
  ContentType,
  IconContents,
  TokenContents,
  contentId,
} from "../../../types";
import { randSuffix } from "../../util/randSuffix";
import { ICONS, ICONS_BY_ID } from "../../icons";
import { withReplacedItem } from "../../util/arrays";

export interface SearchTrayState {
  searchText: string;
  blueprints: Blueprint[];
  open: boolean;
}

export interface SearchTrayHandlers {
  onSearchClicked: () => void;
  onSearchTextChanged: (text: string) => void;
}

type OnDragStart = (draggableId: string) => void;

const defaultBlueprints: Blueprint[] = ICONS.map((icon) => {
  const contents = { type: ContentType.Icon, iconId: icon.id } as const;
  return {
    id: blueprintId(contents),
    contents,
  };
});

function blueprintId(contents: TokenContents): string {
  return `${contentId(contents)}-${randSuffix()}`;
}

export function useSearchTrayState(): [
  SearchTrayState,
  SearchTrayHandlers,
  OnDragStart
] {
  const [searchText, setSearchText] = useState("");
  const [iconBlueprints, setIconBlueprints] =
    useState<Blueprint[]>(defaultBlueprints);
  const [textBlueprint, setTextBlueprint] = useState<Blueprint | undefined>(
    undefined
  );
  const [open, setOpen] = useState(false);

  const blueprints = useMemo(() => {
    const filteredIconBlueprints = iconBlueprints.filter((blueprint) => {
      const contents = blueprint.contents as IconContents;
      return ICONS_BY_ID.get(contents.iconId)!.desc.indexOf(searchText) !== -1;
    });

    if (textBlueprint) {
      return [textBlueprint, ...filteredIconBlueprints];
    }
    return filteredIconBlueprints;
  }, [textBlueprint, iconBlueprints, searchText]);

  const state = useMemo(
    () => ({
      searchText,
      blueprints,
      open,
    }),
    [searchText, blueprints, open]
  );

  const onSearchClicked = useCallback(() => {
    setOpen((open) => !open);
  }, []);

  const onSearchTextChanged = useCallback((text) => {
    setSearchText(text);
    if (text.length > 0 && text.length <= 2) {
      const contents = { text, type: ContentType.Text } as const;
      setTextBlueprint({
        id: blueprintId(contents),
        contents,
      });
    } else {
      setTextBlueprint(undefined);
    }
  }, []);

  const handlers = useMemo(
    () => ({ onSearchClicked, onSearchTextChanged }),
    [onSearchClicked, onSearchTextChanged]
  );

  const onDragStart = useCallback(
    (draggableId: string) => {
      if (textBlueprint?.id === draggableId) {
        setTextBlueprint({
          ...textBlueprint,
          id: blueprintId(textBlueprint.contents),
        });
      } else {
        const draggedBlueprintIdx = iconBlueprints.findIndex(
          (bp) => bp.id === draggableId
        );
        if (draggedBlueprintIdx !== -1) {
          const draggedBlueprint = iconBlueprints[draggedBlueprintIdx];
          console.log({ draggedBlueprint });
          const newBlueprints = withReplacedItem(
            iconBlueprints,
            {
              ...draggedBlueprint,
              id: blueprintId(draggedBlueprint.contents),
            },
            draggedBlueprintIdx
          );
          setIconBlueprints(newBlueprints);
        }
      }
    },
    [iconBlueprints, textBlueprint]
  );

  return [state, handlers, onDragStart];
}
