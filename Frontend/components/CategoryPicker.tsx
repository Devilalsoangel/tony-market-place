import { useMemo, useState } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../utils/theme';
import { CATEGORY_TREE, searchCategories, findMainCategory } from '../utils/categories';

function XIcon({ size = 12, color = colors.textSecondary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M6 6l12 12M18 6L6 18" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

export interface CategoryPickerProps {
  /** Currently selected sub-category strings (may include custom typed ones). */
  value: string[];
  onChange: (next: string[]) => void;
  /** Preselected main category (id or label). If empty the user picks one. */
  mainCategory?: string;
  onMainChange?: (id: string) => void;
  /** Hide the main-category chips (use when the main is fixed, e.g. inside a store). */
  hideMains?: boolean;
  placeholder?: string;
}

/**
 * Type + select category picker. Shows the 17 main categories as chips; tapping
 * one reveals its child sub-categories as multi-select chips. A text input lets
 * the user TYPE to filter across all mains/children and ADD custom sub-categories.
 */
export default function CategoryPicker({
  value,
  onChange,
  mainCategory,
  onMainChange,
  hideMains = false,
  placeholder = 'Type to search or add a sub-category…',
}: CategoryPickerProps) {
  const active = findMainCategory(mainCategory) ?? CATEGORY_TREE[0];
  const [query, setQuery] = useState('');

  const suggestions = useMemo(() => (query.trim() ? searchCategories(query) : []), [query]);

  const toggle = (child: string) => {
    onChange(value.includes(child) ? value.filter((v) => v !== child) : [...value, child]);
  };

  const addCustom = () => {
    const q = query.trim();
    if (!q) return;
    if (!value.includes(q)) onChange([...value, q]);
    setQuery('');
  };

  return (
    <View>
      {/* Main categories */}
      {!hideMains && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {CATEGORY_TREE.map((c) => {
            const isActive = active.id === c.id;
            return (
              <TouchableOpacity
                key={c.id}
                onPress={() => {
                  onMainChange?.(c.id);
                  setQuery('');
                }}
                style={{
                  paddingHorizontal: 14,
                  height: 36,
                  borderRadius: 9999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isActive ? colors.primaryContainer : colors.surfaceContainerLow,
                }}
              >
                <Text
                  className={isActive ? 'font-inter-600' : 'font-inter-500'}
                  style={{ fontSize: 13, lineHeight: 16, color: isActive ? colors.onPrimary : colors.textPrimary }}
                >
                  {c.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {/* Search / add input */}
      <View
        style={{
          marginTop: 10,
          height: 44,
          borderRadius: 14,
          backgroundColor: colors.surfaceContainer,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <TextInput
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={addCustom}
          returnKeyType="done"
          placeholder={placeholder}
          placeholderTextColor={colors.secondary}
          className="flex-1 font-inter-400"
          style={{ fontSize: 14, lineHeight: 18, color: colors.textPrimary }}
        />
        {query.trim().length > 0 && (
          <TouchableOpacity onPress={addCustom} style={{ backgroundColor: colors.primaryContainer, borderRadius: 9999, paddingHorizontal: 12, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 14, color: colors.onPrimary }}>
              Add
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Live suggestions while typing */}
      {suggestions.length > 0 && (
        <View style={{ marginTop: 8, gap: 6 }}>
          <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            Suggestions
          </Text>
          {suggestions.map(({ main, matchedChildren }) => (
            <View key={main.id} style={{ gap: 6 }}>
              <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 16, color: colors.primary }}>
                {main.label}
              </Text>
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {matchedChildren.map((ch) => (
                  <TouchableOpacity
                    key={ch}
                    onPress={() => {
                      toggle(ch);
                      setQuery('');
                    }}
                    style={{
                      paddingHorizontal: 12,
                      height: 30,
                      borderRadius: 9999,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: value.includes(ch) ? colors.primaryContainer : colors.surfaceContainer,
                    }}
                  >
                    <Text className="font-inter-500" style={{ fontSize: 12, lineHeight: 14, color: value.includes(ch) ? colors.onPrimary : colors.textPrimary }}>
                      {ch}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Child sub-categories of active main */}
      {query.trim().length === 0 && active.children.length > 0 && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            {active.label} sub-categories
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {active.children.map((ch) => {
              const on = value.includes(ch);
              return (
                <TouchableOpacity
                  key={ch}
                  onPress={() => toggle(ch)}
                  style={{
                    paddingHorizontal: 12,
                    height: 32,
                    borderRadius: 9999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? colors.primaryContainer : colors.surfaceContainerLow,
                    borderWidth: on ? 0 : 1,
                    borderColor: colors.outlineVariant,
                  }}
                >
                  <Text className={on ? 'font-inter-600' : 'font-inter-500'} style={{ fontSize: 13, lineHeight: 16, color: on ? colors.onPrimary : colors.textPrimary }}>
                    {ch}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Selected chips (removable) */}
      {value.length > 0 && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <Text className="font-inter-600" style={{ fontSize: 12, lineHeight: 16, color: colors.textSecondary }}>
            Selected ({value.length})
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 8 }}>
            {value.map((ch) => (
              <TouchableOpacity
                key={ch}
                onPress={() => onChange(value.filter((v) => v !== ch))}
                className="flex-row items-center"
                style={{
                  paddingLeft: 12,
                  paddingRight: 8,
                  height: 32,
                  borderRadius: 9999,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.primaryContainer,
                  gap: 6,
                }}
              >
                <Text className="font-inter-600" style={{ fontSize: 13, lineHeight: 16, color: colors.onPrimary }}>
                  {ch}
                </Text>
                <XIcon size={12} color={colors.onPrimary} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}