import streamlit as st
import json
from datetime import datetime,date
import calendar
import time
import emoji

st.set_page_config(page_title="Convo Metrics",)

def date_to_day(date):
   date_object = datetime.strptime(date, '%Y-%m-%d').date()
   x = calendar.day_name[date_object.weekday()]
   return x

st.title('Decode Your Chats: Telegram Insights at Your Fingertips!')
data = st.file_uploader('Upload Your Chat File',type='json')

text = '''Steps to get your chat file:-\n
    1 - Open Telegram app on your PC
    2 - Go to your preferred chat
    3 - Click on three dots on top right corner
    4 - Click on export chat and export it in json format
'''




x = st.write(text) 
if data is not None:
    data = json.load(data)


    participants = {} #to count messages per peroson
    CombinedWordsCount = {} 
    totalmsgs = len(data['messages'])

    min_word_lenght = 3 #minmum lenght for most used mostUsedWords

    #total count of per persons
    CharactersCount = {}
    WordsCount = {}

    #word count per person per word
    wordsPerPerson = {}
    mostUsedWords = {}

    #count of hour,day,date per person
    MsgPerDate = {}
    MsgPerHour = {}
    MsgPerDay = {}
    
    #count of emojis
    combinedEmojiCount = {}
    perPersonEmojis = {}
    mostUsedEmojis = {}
    #main loop
    for i in data['messages']:

        if i['type'] == 'message':
            if i['from'] not in participants:
                mostUsedWords[i['from']] = {}
                participants[i['from']] = 0
                CharactersCount[i['from']] = 0
                WordsCount[i['from']] = 0
                wordsPerPerson[i['from']] = {}
                
                MsgPerDay[i['from']] = {"Monday":0,'Tuesday':0,'Wednesday':0,'Thursday':0,'Friday':0,'Saturday':0,'Sunday':0}
                MsgPerHour[i['from']] = {}
                MsgPerDate[i['from']] = {}
                mostUsedEmojis[i['from']] = {}
                perPersonEmojis[i['from']] = {}


            if i['date'][0:10] not in MsgPerDate[i['from']]:
                MsgPerDate[i['from']][i['date'][0:10]] = 0

            if i['date'][11:13] not in MsgPerHour[i['from']]:
                MsgPerHour[i['from']][i['date'][11:13]] = 0

            participants[i['from']] += 1
            MsgPerDate[i['from']][i['date'][0:10]] +=1
            MsgPerHour[i['from']][i['date'][11:13]] += 1
            MsgPerDay[i['from']][date_to_day(i['date'][0:10])] +=1


            if type(i['text']) != list:
                for j in i['text'].lower().split():
                    if emoji.emoji_count(j) > 0:
                        for em in j:
                            if emoji.is_emoji(em):
                                if em not in combinedEmojiCount:
                                    combinedEmojiCount[em] = 0

                                if em not in perPersonEmojis[i['from']]:
                                    perPersonEmojis[i['from']][em] = 0

                                combinedEmojiCount[em] += 1
                                perPersonEmojis[i['from']][em] += 1
                    
                    if j.lower() not in CombinedWordsCount and len(j)>min_word_lenght:
                        CombinedWordsCount[j.lower()] = 0
                        

                    if j.lower() not in wordsPerPerson[i['from']] and len(j)>min_word_lenght:
                        wordsPerPerson[i['from']][j.lower()] = 1

                    if len(j.lower())> min_word_lenght:
                        CombinedWordsCount[j.lower()] += 1
                        wordsPerPerson[i['from']][j.lower()] += 1
                    
                    


                CharactersCount[i['from']] += len(i['text'].replace(" ", ""))
                WordsCount[i['from']] += len(i['text'].split())


    #sorting dictionaries
    CombinedWordsCount = sorted(CombinedWordsCount.items(), key=lambda x:x[1] ,reverse = True)
    CombinedWordsCount = dict(CombinedWordsCount[0:16])
    combinedEmojiCount = dict(sorted(combinedEmojiCount.items(), key=lambda x:x[1], reverse=True)[0:11])
    

    totalDays = 0
    for i in MsgPerDate:
        if len(MsgPerDate[i]) > totalDays:
            totalDays = len(MsgPerDate[i])


    for i in participants:
        temp = sorted(wordsPerPerson[i].items(),key=lambda x:x[1] , reverse = True)
        temp = dict(temp)
        wordsPerPerson[i] = temp
        del temp



    for i in CombinedWordsCount:
        for j in mostUsedWords:
            mostUsedWords[j][i] = 0
            if i in wordsPerPerson[j]:
                mostUsedWords[j][i] += wordsPerPerson[j][i]

    for i in combinedEmojiCount:
        for j in mostUsedEmojis:
            mostUsedEmojis[j][i] = 0
            if i in perPersonEmojis[j]:
                mostUsedEmojis[j][i] += perPersonEmojis[j][i]



    st.header(f'''General Metrics
        Total Messages - {totalmsgs}
    Total Words - {sum(WordsCount.values())}
    Total Characters - {sum(CharactersCount.values())}
    Total Days Talked - {totalDays}
    Total Participants - {len(participants)}'''   
          )

    col1, col2 , col3 = st.columns(3)

    with col1:
        st.subheader('Total Messages')
        st.bar_chart(participants)
    with col2:
        st.subheader('Total words')
        st.bar_chart(WordsCount)

    with col3:
        st.subheader('Total Charaters')
        st.bar_chart(CharactersCount)


    st.header('Averages')
    st.subheader(f'''Averages Per Messages
        Words - {str(sum((WordsCount.values()))/totalmsgs)[0:4]}
    Characters -  {str(sum((CharactersCount.values()))/totalmsgs)[0:5]}''')



    adm = {}
    for i in WordsCount:
        adm[i]= (WordsCount[i]/participants[i])
        

    cdm= {}
    for i in CharactersCount:
        cdm[i]= (CharactersCount[i]/participants[i])


    col1 , col2 = st.columns(2)
    with col1:
        st.subheader('Words')
        st.bar_chart(adm)

    with col2:
        st.subheader('Characters')
        st.bar_chart(cdm)

    st.subheader(f'''Daily Averages
                Messages - {str(totalmsgs/totalDays).split('.')[0]}
                Words - {str(sum((WordsCount.values()))/totalDays).split('.')[0]}
                Characters - {str(sum(CharactersCount.values())/totalDays).split('.')[0]}
                ''')


    col1,col2,col3 = st.columns(3)

    mdm = {}
    for i in participants:
        mdm[i] = participants[i]/totalDays
    with col1:
        st.subheader('Messages')
        st.bar_chart(mdm)

    wdm = {}
    for i in WordsCount:
        wdm[i] = WordsCount[i]/totalDays

    with col2:
        st.subheader('Words')
        st.bar_chart(wdm)   

    cdmm = {}
    for i in CharactersCount:
        cdmm[i] = CharactersCount[i]/totalDays

    with col3:
        st.subheader('Characters')
        st.bar_chart(cdmm)




    st.header('Most Used Words')
    st.bar_chart(data=mostUsedWords)

    st.header('Date-Wise Stats')
    st.bar_chart(data=MsgPerDate)

    st.header('Weekly Stats')
    st.bar_chart(data=MsgPerDay)

    st.header('Hourly Stats')
    st.bar_chart(data=MsgPerHour)
    
    st.header('Emoji Stats')
    st.bar_chart(data=mostUsedEmojis)



st.write('Made with ❤️ by Meet')
st.write("If you like this app, please give a ⭐ on the Github")


