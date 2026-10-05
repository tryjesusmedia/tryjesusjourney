import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chronologicalGuide, type ChronologicalSection, type GuideBlock } from '@/data/chronologicalBiblePlan';
import { colors } from '@/constants/theme';

function Blocks({blocks}:{blocks:GuideBlock[]}) {
  return <>{blocks.map((block,i)=><Text key={i} selectable style={block.style.startsWith('HEADING') ? styles.heading : styles.body}>{block.text}</Text>)}</>;
}
function Fold({title,children,initiallyOpen=false}:{title:string;children:React.ReactNode;initiallyOpen?:boolean}) {
  const [open,setOpen]=useState(initiallyOpen);
  return <View style={styles.fold}><Pressable accessibilityRole="button" accessibilityState={{expanded:open}} onPress={()=>setOpen(!open)} style={styles.toggle}><Text style={styles.heading}>{title}</Text><Text style={styles.chevron}>{open?'−':'+'}</Text></Pressable>{open?<View style={styles.content}>{children}</View>:null}</View>;
}
export function SectionGuide({section}:{section:ChronologicalSection}) {
  return <Fold title="About this section"><Blocks blocks={section.introduction}/></Fold>;
}
export function SectionReflection({section}:{section:ChronologicalSection}) {
  return <Fold title="Pause and reflect"><Blocks blocks={section.reflection}/></Fold>;
}
export function ReadingGuidance({paragraphs}:{paragraphs:string[]}) {
  return <View style={styles.content}>{paragraphs.map((text,i)=><Text key={i} selectable style={styles.body}>{text}</Text>)}<Text style={styles.body}>A few notes in your own notebook can help you remember what you noticed.</Text></View>;
}
export function ChronologicalGuide() {
  return <View style={styles.content}><Text style={styles.title}>Your reading guide</Text><Text style={styles.body}>Bring your Bible. Follow the story. Take one small step at a time.</Text>{chronologicalGuide.map(group=><Fold key={group.title} title={group.title}>
    {group.table ? <><Blocks blocks={group.blocks.slice(0,1)}/><View accessibilityRole="summary" style={styles.table}>{group.table.map((row,i)=><View key={i} style={styles.row}>{row.map((cell,j)=><Text key={j} style={[styles.cell,i===0&&styles.columnHeading]}>{cell}</Text>)}</View>)}</View><Blocks blocks={group.blocks.slice(1)}/></> : <Blocks blocks={group.blocks}/>}
  </Fold>)}</View>;
}
const styles=StyleSheet.create({
  title:{color:colors.text,fontSize:26,fontWeight:'800',lineHeight:34},
  body:{color:colors.ivory,fontSize:17,lineHeight:27},
  heading:{color:colors.text,fontSize:18,lineHeight:26,fontWeight:'700',flexShrink:1},
  content:{gap:16},fold:{borderWidth:1,borderColor:colors.border,borderRadius:12,padding:14,backgroundColor:colors.panel},
  toggle:{minHeight:44,flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:12,marginBottom:8},
  chevron:{color:colors.gold,fontSize:24},table:{borderWidth:1,borderColor:colors.border},row:{flexDirection:'row',borderBottomWidth:1,borderColor:colors.border},
  cell:{flex:1,padding:7,fontSize:14,lineHeight:21,color:colors.ivory},columnHeading:{fontWeight:'700',color:colors.gold},
});
